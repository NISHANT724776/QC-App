import { Injectable, inject, signal } from '@angular/core';
import { InspectionRepository } from '../../data/repositories';
import { markPhotosUploaded, pendingPhotos } from '../../domain/rules/photos';
import { LocalDb } from '../storage/local-db';
import { FormStore } from './form-store';
import { MastersStore } from './masters-store';
import { RequestsStore } from './requests-store';

/**
 * Sync = push (results + queued photos) then pull (requests + form configuration), as in the source
 * app's Sync button. Pending completions are never overwritten by a pull.
 */
@Injectable({ providedIn: 'root' })
export class Sync {
  private readonly repo = inject(InspectionRepository);
  private readonly db = inject(LocalDb);
  private readonly requests = inject(RequestsStore);
  private readonly forms = inject(FormStore);
  private readonly masters = inject(MastersStore);

  readonly syncing = signal(false);
  readonly lastSync = signal<string | null>(null);

  async init(): Promise<void> {
    this.lastSync.set((await this.db.get<string>('meta:lastSync')) ?? null);
    await this.requests.ensureLoaded();
    await this.forms.refreshPending();
  }

  /** Runs a full sync. Throws Error('Msg_NoInternetConnection') when offline. */
  async run(): Promise<void> {
    if (this.syncing()) return;
    if (!navigator.onLine) throw new Error('Msg_NoInternetConnection');
    this.syncing.set(true);
    try {
      await this.push();
      await this.pull();
      const now = new Date().toISOString();
      await this.db.set('meta:lastSync', now);
      this.lastSync.set(now);
    } finally {
      this.syncing.set(false);
      await this.forms.refreshPending();
    }
  }

  private async push(): Promise<void> {
    // 1. submitted results
    for (const { orderId } of this.requests.pendingOrders()) {
      const form = await this.forms.getSubmitted(orderId);
      if (!form) continue;
      const photos = pendingPhotos(form).map((p) => p.id);
      if (photos.length) await this.repo.uploadAttachments(orderId, photos);
      const uploaded = markPhotosUploaded(structuredClone(form));
      await this.repo.submitResult(uploaded);
      await this.forms.setSubmitted(uploaded);
      await this.requests.markOrderSynced(orderId);
    }
    // 2. queued photos of drafts
    for (const orderId of await this.forms.draftOrderIds()) {
      const draft = await this.forms.getDraft(orderId);
      if (!draft) continue;
      const photos = pendingPhotos(draft).map((p) => p.id);
      if (!photos.length) continue;
      await this.repo.uploadAttachments(orderId, photos);
      await this.forms.saveDraft(markPhotosUploaded(structuredClone(draft)));
    }
  }

  private async pull(): Promise<void> {
    const server = await this.repo.fetchRequests();
    await this.requests.merge(server);
    const open = server.filter((r) => r.status === 'Active').flatMap((r) => r.orders.filter((o) => !o.isCompleted));
    for (const o of open) await this.forms.cacheConfig(o.qaRequestOrderId);
    await this.masters.refresh(); // Add-Ons reference data (articles, production orders, defect master …)
  }
}

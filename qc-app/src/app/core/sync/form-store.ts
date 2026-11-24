import { Injectable, inject, signal } from '@angular/core';
import { InspectionRepository } from '../../data/repositories';
import { InspectionForm } from '../../domain/models/inspection';
import { pendingPhotos } from '../../domain/rules/photos';
import { normalizeDefects } from '../../domain/rules/defect-groups.rule';
import { LocalDb } from '../storage/local-db';
import { RequestsStore } from './requests-store';
import { summaryTotals } from '../../domain/rules/summary.rule';

/** Local persistence of inspection forms: config cache, drafts and submitted-but-unsynced results. */
@Injectable({ providedIn: 'root' })
export class FormStore {
  private readonly db = inject(LocalDb);
  private readonly repo = inject(InspectionRepository);
  private readonly requests = inject(RequestsStore);

  /** Badge on the request list: photos still waiting in the upload queue. */
  readonly pendingUploads = signal(0);

  async load(orderId: string): Promise<InspectionForm> {
    return normalizeDefects(await this.loadRaw(orderId));
  }

  private async loadRaw(orderId: string): Promise<InspectionForm> {
    const submitted = await this.db.get<InspectionForm>(`submitted:${orderId}`);
    if (submitted) return submitted;
    const draft = await this.db.get<InspectionForm>(`draft:${orderId}`);
    if (draft) return draft;
    const cached = await this.db.get<InspectionForm>(`config:${orderId}`);
    if (cached) return cached;
    const fresh = await this.repo.fetchForm(orderId); // throws when offline/unreachable
    await this.db.set(`config:${orderId}`, fresh);
    return fresh;
  }

  async saveDraft(form: InspectionForm): Promise<void> {
    await this.db.set(`draft:${form.orderId}`, form);
    await this.refreshPending();
  }

  /** Submit locally: becomes a pending outbox item (red sync icon) until Sync pushes it. */
  async submitLocal(form: InspectionForm, statusText: string): Promise<void> {
    const submitted: InspectionForm = { ...form, status: 'submitted' };
    await this.db.set(`submitted:${form.orderId}`, submitted);
    await this.db.remove(`draft:${form.orderId}`);
    const offered = summaryTotals(form.summary.rows).offered;
    await this.requests.markOrderSubmitted(form.requestId, form.orderId, offered, statusText);
    await this.refreshPending();
  }

  async cacheConfig(orderId: string): Promise<void> {
    if (await this.db.get(`config:${orderId}`)) return;
    await this.db.set(`config:${orderId}`, await this.repo.fetchForm(orderId));
  }

  async getSubmitted(orderId: string): Promise<InspectionForm | undefined> {
    return this.db.get<InspectionForm>(`submitted:${orderId}`);
  }

  async setSubmitted(form: InspectionForm): Promise<void> {
    await this.db.set(`submitted:${form.orderId}`, form);
    await this.refreshPending();
  }

  async draftOrderIds(): Promise<string[]> {
    return (await this.db.keys('draft:')).map((k) => k.slice('draft:'.length));
  }

  async getDraft(orderId: string): Promise<InspectionForm | undefined> {
    return this.db.get<InspectionForm>(`draft:${orderId}`);
  }

  /** Saved forms (drafts and submitted results) – one per order, a submitted result wins over its draft. */
  async savedForms(): Promise<InspectionForm[]> {
    const byOrder = new Map<string, InspectionForm>();
    for (const k of await this.db.keys('draft:')) {
      const f = await this.db.get<InspectionForm>(k);
      if (f) byOrder.set(f.orderId, f);
    }
    for (const k of await this.db.keys('submitted:')) {
      const f = await this.db.get<InspectionForm>(k);
      if (f) byOrder.set(f.orderId, f);
    }
    return [...byOrder.values()];
  }

  async refreshPending(): Promise<void> {
    let n = 0;
    for (const k of [...(await this.db.keys('draft:')), ...(await this.db.keys('submitted:'))]) {
      const f = await this.db.get<InspectionForm>(k);
      if (f) n += pendingPhotos(f).length;
    }
    this.pendingUploads.set(n);
  }
}

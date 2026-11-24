import { Injectable, inject, signal } from '@angular/core';
import { MastersRepository } from '../../data/repositories';
import { MastersData } from '../../domain/models/masters';
import { LocalDb } from '../storage/local-db';

/** Reference data for the QC Add-Ons forms. Cached on the device by Sync so the forms also open offline. */
@Injectable({ providedIn: 'root' })
export class MastersStore {
  private readonly repo = inject(MastersRepository);
  private readonly db = inject(LocalDb);
  readonly data = signal<MastersData | null>(null);

  async ensure(): Promise<MastersData> {
    const cur = this.data();
    if (cur) return cur;
    const cached = await this.db.get<MastersData>('masters');
    if (cached) {
      this.data.set(cached);
      return cached;
    }
    return this.refresh();
  }

  /** Called by Sync (pull). */
  async refresh(): Promise<MastersData> {
    const fresh = await this.repo.fetchMasters();
    this.data.set(fresh);
    await this.db.set('masters', fresh);
    return fresh;
  }
}

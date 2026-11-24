import { Injectable, inject, signal } from '@angular/core';
import { InspectionRequest, RequestPage, RequestQuery } from '../../domain/models/request';
import { LocalDb } from '../storage/local-db';

/** Local (offline-first) copy of the user's inspection requests. Filled by Sync (pull). */
@Injectable({ providedIn: 'root' })
export class RequestsStore {
  private readonly db = inject(LocalDb);
  /** bumps whenever data changes so views re-query */
  readonly version = signal(0);
  private all: InspectionRequest[] = [];
  private loaded = false;

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.all = (await this.db.get<InspectionRequest[]>('requests')) ?? [];
    this.loaded = true;
    this.version.update((v) => v + 1);
  }

  get isEmpty(): boolean {
    return this.all.length === 0;
  }

  /** Add a request created on this device (QC Add-Ons) so it shows up in Active Requests immediately. */
  async add(request: InspectionRequest): Promise<void> {
    this.all = [request, ...this.all.filter((r) => r.qaRequestId !== request.qaRequestId)];
    await this.persist();
  }

  find(requestId: string): InspectionRequest | undefined {
    return this.all.find((r) => r.qaRequestId === requestId);
  }

  /** Synchronous local query – paging happens over the local store; the server is only hit by Sync. */
  query(q: RequestQuery): RequestPage {
    this.version(); // dependency for computed()/effects
    const needle = q.search.trim().toLowerCase();
    const kindOf = (r: InspectionRequest) => r.kind ?? 'inspection';
    const tabItems = this.all.filter((r) => (q.tab === 'active' ? r.status === 'Active' : r.status === 'Completed') && (!q.kind || kindOf(r) === q.kind));
    const dates = [...new Set(tabItems.map((r) => r.date))];
    let items = tabItems.filter((r) => (!q.from || r.date >= q.from) && (!q.to || r.date <= q.to));
    if (needle) {
      items = items.filter((r) =>
        [r.tranNum, r.articleName, r.articleCode, r.supplierName, r.inspectionType, r.sample?.sampleType ?? '', ...r.orders.flatMap((o) => [o.orderRefNo, o.styleName, o.colorName])]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      );
    }
    items = [...items].sort((a, b) =>
      q.tab === 'active' ? a.date.localeCompare(b.date) || a.tranNum.localeCompare(b.tranNum) : b.date.localeCompare(a.date) || b.tranNum.localeCompare(a.tranNum),
    );
    return { items: items.slice(0, q.page * q.pageSize), total: items.length, datesWithRequests: dates };
  }

  /** Merge a server pull. Local pending (unsynced) completions always win. */
  async merge(server: InspectionRequest[]): Promise<void> {
    const local = new Map(this.all.map((r) => [r.qaRequestId, r]));
    const merged: InspectionRequest[] = [];
    for (const s of server) {
      const l = local.get(s.qaRequestId);
      if (s.status === 'Cancelled') continue;
      const orders = s.orders.map((so) => {
        const lo = l?.orders.find((o) => o.qaRequestOrderId === so.qaRequestOrderId);
        return lo && lo.syncState === 'pending' ? lo : so;
      });
      // a request without order lines (sample evaluation) keeps the server status; otherwise status follows its orders
      merged.push({ ...s, orders, status: orders.length ? (orders.every((o) => o.isCompleted) ? 'Completed' : 'Active') : s.status });
    }
    this.all = merged;
    await this.persist();
  }

  async markOrderSubmitted(requestId: string, orderId: string, offeredTotal: number, status: string): Promise<void> {
    this.patchOrder(requestId, orderId, (o) => ({
      ...o, isCompleted: true, syncState: 'pending', status, actualOfferedQty: offeredTotal, acceptedQty: offeredTotal,
    }));
    await this.persist();
  }

  async markOrderSynced(orderId: string): Promise<void> {
    this.all = this.all.map((r) => ({
      ...r,
      orders: r.orders.map((o) => (o.qaRequestOrderId === orderId ? { ...o, syncState: 'synced' as const } : o)),
    }));
    await this.persist();
  }

  async remove(requestId: string): Promise<void> {
    this.all = this.all.filter((r) => r.qaRequestId !== requestId);
    await this.persist();
  }

  pendingOrders(): { requestId: string; orderId: string }[] {
    return this.all.flatMap((r) =>
      r.orders.filter((o) => o.syncState === 'pending').map((o) => ({ requestId: r.qaRequestId, orderId: o.qaRequestOrderId })),
    );
  }

  private patchOrder(requestId: string, orderId: string, fn: (o: InspectionRequest['orders'][number]) => InspectionRequest['orders'][number]) {
    this.all = this.all.map((r) => {
      if (r.qaRequestId !== requestId) return r;
      const orders = r.orders.map((o) => (o.qaRequestOrderId === orderId ? fn(o) : o));
      return { ...r, orders, status: orders.every((o) => o.isCompleted) ? ('Completed' as const) : r.status };
    });
  }

  private async persist(): Promise<void> {
    await this.db.set('requests', this.all);
    this.version.update((v) => v + 1);
  }
}

import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LocalDb } from '../../core/storage/local-db';
import { InspectionForm } from '../../domain/models/inspection';
import { InspectionRequest } from '../../domain/models/request';
import {
  AuthRepository,
  InspectionRepository,
  MastersRepository,
  NewRequestDraft,
  RegistrationInput,
  RegistrationResult,
} from '../repositories';
import { MastersData } from '../../domain/models/masters';
import { MASTERS } from './mock-masters';
import { buildForm, buildRequests, findOrderRequest } from './mock-data';
import { buildPdf, reportLines } from './pdf';

const delay = (ms = environment.mockLatencyMs) => new Promise<void>((r) => setTimeout(r, ms));

interface ServerState {
  /** requests created through QC Add-Ons */
  created: InspectionRequest[];
  cancelled: string[];
  results: Record<string, InspectionForm>;
  uploaded: Record<string, string[]>;
}

@Injectable({ providedIn: 'root' })
export class MockMastersRepository extends MastersRepository {
  async fetchMasters(): Promise<MastersData> {
    await delay(150);
    return structuredClone(MASTERS);
  }
}

@Injectable({ providedIn: 'root' })
export class MockAuthRepository extends AuthRepository {
  async register(input: RegistrationInput): Promise<RegistrationResult> {
    await delay();
    if (!input.username || !input.password || !input.companyId || !input.companyUrl) {
      throw new Error('Registration_Required');
    }
    // MOCK: any non-empty credentials are accepted. The real rules come from the backend (docs Q-3).
    const displayName = input.username === 'wfxmob' ? 'WFXMobile' : input.username.charAt(0).toUpperCase() + input.username.slice(1);
    return { displayName, token: `mock-token-${Date.now()}` };
  }
}

/** In-memory + IndexedDB-persisted fake of the WFX server. */
@Injectable({ providedIn: 'root' })
export class MockInspectionRepository extends InspectionRepository {
  private readonly db = inject(LocalDb);
  private state?: ServerState;

  private async load(): Promise<ServerState> {
    if (!this.state) {
      this.state = (await this.db.get<ServerState>('srv:state')) ?? { created: [], cancelled: [], results: {}, uploaded: {} };
      this.state.created ??= [];
    }
    return this.state;
  }
  private async save(): Promise<void> {
    await this.db.set('srv:state', this.state);
  }

  async fetchRequests(): Promise<InspectionRequest[]> {
    await delay();
    const s = await this.load();
    return [...buildRequests(), ...s.created].map((r) => {
      if (s.cancelled.includes(r.qaRequestId)) return { ...r, status: 'Cancelled' as const };
      const orders = r.orders.map((o) => {
        const res = s.results[o.qaRequestOrderId];
        if (!res) return o;
        return { ...o, isCompleted: true, syncState: 'synced' as const, status: 'Confirmed', actualOfferedQty: o.offeredQty, acceptedQty: o.offeredQty };
      });
      const completed = orders.length > 0 && orders.every((o) => o.isCompleted);
      return { ...r, orders, status: completed ? ('Completed' as const) : r.status };
    });
  }

  async fetchForm(orderId: string): Promise<InspectionForm> {
    await delay(150);
    const s = await this.load();
    if (s.results[orderId]) return s.results[orderId];
    const req = findOrderRequest([...buildRequests(), ...s.created], orderId);
    if (!req) throw new Error(`Unknown order ${orderId}`);
    return buildForm(req, orderId);
  }

  async createRequest(draft: NewRequestDraft): Promise<InspectionRequest> {
    await delay();
    const s = await this.load();
    // number sequence continues after the seeded requests (IR-7300…7303 / SE-…)
    const used = [...buildRequests(), ...s.created].map((r) => r.tranNum);
    let n = 7300;
    while (used.includes(`${draft.prefix}-${n}`)) n++;
    const tranNum = `${draft.prefix}-${n}`;
    const qaRequestId = `qr-${tranNum.toLowerCase()}`;
    const { prefix: _p, orders, ...rest } = draft;
    const created: InspectionRequest = {
      ...rest,
      qaRequestId,
      tranNum,
      status: 'Active',
      orders: orders.map((o, i) => ({ ...o, qaRequestOrderId: `qo-${tranNum.toLowerCase()}-${o.orderRefNo}-${i}` })),
    };
    s.created.push(created);
    await this.save();
    return structuredClone(created);
  }

  async submitResult(form: InspectionForm): Promise<void> {
    await delay();
    const s = await this.load();
    s.results[form.orderId] = { ...form, status: 'submitted' };
    await this.save();
  }

  async uploadAttachments(orderId: string, photoIds: string[]): Promise<void> {
    await delay(150);
    const s = await this.load();
    s.uploaded[orderId] = [...new Set([...(s.uploaded[orderId] ?? []), ...photoIds])];
    await this.save();
  }

  async cancelRequest(requestId: string): Promise<void> {
    await delay();
    const s = await this.load();
    if (!s.cancelled.includes(requestId)) s.cancelled.push(requestId);
    await this.save();
  }

  async fetchReport(requestId: string, orderId: string): Promise<Blob> {
    await delay(250);
    const s = await this.load();
    const form = s.results[orderId];
    if (form) return buildPdf(reportLines(form));
    // Seeded completed order without a stored form – generate a report from default form data.
    const req = findOrderRequest([...buildRequests(), ...s.created], orderId);
    if (!req || req.qaRequestId !== requestId) throw new Error('Report not found');
    return buildPdf(reportLines({ ...buildForm(req, orderId), status: 'submitted' }));
  }

  async fetchAttachment(_fileUrl: string, fileName: string): Promise<Blob> {
    await delay(200);
    return buildPdf(['Sample attachment (mock server)', '', fileName]);
  }

  async sendReportEmail(_requestId: string, _orderId: string): Promise<void> {
    await delay();
  }
}

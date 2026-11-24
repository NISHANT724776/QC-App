import { InspectionForm } from '../domain/models/inspection';
import { MastersData } from '../domain/models/masters';
import { InspectionRequest, OrderLine } from '../domain/models/request';

/**
 * Data-access contracts. UI and stores depend ONLY on these abstract classes.
 * The mock implementations (data/mock) can be swapped for HTTP implementations in
 * data/provide-data.ts without touching any feature code (docs Q-3).
 */
export interface RegistrationInput {
  username: string;
  password: string;
  companyId: string;
  companyUrl: string;
}
export interface RegistrationResult {
  displayName: string;
  token: string;
}

/** Input for creating a request from the QC Add-Ons forms; the server assigns the request/order ids and number. */
export type NewRequestDraft = Omit<InspectionRequest, 'qaRequestId' | 'tranNum' | 'orders' | 'status'> & {
  prefix: 'IR' | 'SE';
  orders: Omit<OrderLine, 'qaRequestOrderId'>[];
};

export abstract class AuthRepository {
  abstract register(input: RegistrationInput): Promise<RegistrationResult>;
}

export abstract class MastersRepository {
  /** Reference data for the Add-Ons forms (articles, production orders, colours/sizes, defect master …). */
  abstract fetchMasters(): Promise<MastersData>;
}

export abstract class InspectionRepository {
  /** Create a new inspection request / sample evaluation (QC Add-Ons). Returns the stored request with its number. */
  abstract createRequest(draft: NewRequestDraft): Promise<InspectionRequest>;
  /** All requests assigned to the user (Active + Completed + Cancelled). Called by Sync (pull). */
  abstract fetchRequests(): Promise<InspectionRequest[]>;
  /** Form configuration + any previously stored values for one order. */
  abstract fetchForm(orderId: string): Promise<InspectionForm>;
  /** Push a submitted result (Sync push). */
  abstract submitResult(form: InspectionForm): Promise<void>;
  /** Upload queued photos of an order (Sync push). */
  abstract uploadAttachments(orderId: string, photoIds: string[]): Promise<void>;
  abstract cancelRequest(requestId: string): Promise<void>;
  /** PDF report for a completed order, generated on the server. */
  abstract fetchReport(requestId: string, orderId: string): Promise<Blob>;
  /** Request-level attachment (e.g. tech pack PDF). */
  abstract fetchAttachment(fileUrl: string, fileName: string): Promise<Blob>;
  abstract sendReportEmail(requestId: string, orderId: string): Promise<void>;
}

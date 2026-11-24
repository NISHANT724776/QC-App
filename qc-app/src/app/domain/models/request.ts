export type RequestTab = 'active' | 'completed';
/** QC Add-Ons: a request is either an inspection or a sample evaluation (docs: QC App Add Ons). */
export type RequestKind = 'inspection' | 'sample';
export type RequestStatus = 'Active' | 'Completed' | 'Cancelled';
/** none = not completed, pending = saved on device (red icon), synced = on server (green icon) */
export type SyncState = 'none' | 'pending' | 'synced';

export interface RequestAttachment {
  id: string;
  userFileName: string;
  fileUrl: string;
}

export interface OrderLine {
  qaRequestOrderId: string;
  orderRefNo: string;
  styleName: string;
  colorName: string;
  orderQty: number;
  offeredQty: number;
  actualOfferedQty: number | null;
  acceptedQty: number | null;
  deliveryDate: string;
  /** Colour x size quantities (flat array, index = colour * sizes + size) – set for orders created through Add-Ons */
  matrix?: { ordered: number[]; offered: number[] };
  /** Result status text (e.g. "Confirmed") once completed */
  status: string | null;
  syncState: SyncState;
  isCompleted: boolean;
}

/** Summary of a sample evaluation (the colour/size lines, quantity and photos captured when it was created). */
export interface SampleSummary {
  sampleType: string;
  lines: number;
  qty: number;
  uom: string;
  photos: number;
  swnNo?: string;
}

export interface InspectionRequest {
  /** undefined = inspection (requests created before Add-Ons) */
  kind?: RequestKind;
  /** target / result-required-by date (yyyy-MM-dd) – drives the "Due in Nd" chip on Active requests */
  dueDate?: string;
  /** shown as a NEW badge until its result is entered */
  isNew?: boolean;
  sample?: SampleSummary;
  qaRequestId: string;
  tranNum: string;
  inspectionType: string;
  articleCode: string;
  buyerRef: string;
  articleName: string;
  supplierName: string;
  imageUrl: string | null;
  /** ISO date (yyyy-MM-dd) used for the date group heading and calendar dots */
  date: string;
  styleCount: number;
  isInspectionCancel: boolean;
  isExpanderEnable: boolean;
  comment: string;
  attachments: RequestAttachment[];
  orders: OrderLine[];
  status: RequestStatus;
}

export interface RequestQuery {
  tab: RequestTab;
  search: string;
  /** all kinds when undefined */
  kind?: RequestKind;
  /** inclusive ISO dates; null = no filter */
  from: string | null;
  to: string | null;
  page: number;
  pageSize: number;
}

export interface RequestPage {
  items: InspectionRequest[];
  total: number;
  /** ISO dates (of the whole tab, ignoring paging) that have requests – used for calendar dots */
  datesWithRequests: string[];
}

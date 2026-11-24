export interface PhotoAttachment {
  id: string;
  name: string;
  dataUrl: string;
  comment: string;
  /** false = still in the upload queue (counted by the pending-upload badge) */
  uploaded: boolean;
}

export type SectionKind = 'summary' | 'ra' | 'measurement' | 'defects' | 'evaluation' | 'final';

export interface InspectionSection {
  key: string;
  label: string;
  kind: SectionKind;
  /** evaluation group id when kind === 'evaluation' */
  groupId?: string;
}

/* ---------------- Summary ---------------- */
export interface SummaryRow {
  id: string; // QARequestOrderColorSizeID
  colorName: string;
  colorCode: string;
  sizeCode: string;
  ordered: number;
  offered: number | null;
  inspected: number | null;
}
export interface SummaryData {
  standards: string[];
  originalStandard: string;
  reviseStandard: string | null;
  rows: SummaryRow[];
  cartonsOffered: string;
  cartonsInspected: string;
  cartonNumbers: string[];
}

/* ---------------- RA Sheet ---------------- */
export interface RaRow {
  id: string;
  activity: string;
  risk: string;
  actionRequired: string;
  comments: string;
  attachments: PhotoAttachment[];
}

/* ---------------- Measurement ---------------- */
export interface MeasurementPom {
  code: string;
  name: string;
  required: string;
  tolPositive: string;
  tolNegative: string;
  critical: boolean;
  /** one entry per sample column (fractional-inch text) */
  actuals: string[];
}
export interface MeasurementSample {
  color: string | null;
}
export interface MeasurementSize {
  sizeCode: string;
  samples: MeasurementSample[];
  poms: MeasurementPom[];
}
export interface MeasurementData {
  colors: string[];
  sizes: MeasurementSize[];
}

/* ---------------- Defects ---------------- */
export interface DefectItem {
  id: string;
  name: string;
  critical: boolean;
  comments: string;
  major: number;
  minor: number;
  micro: number;
  photos: PhotoAttachment[];
  /** true = row comes from the QC Defects master (title read-only, Critical comes from the master) */
  fromMaster?: boolean;
  /** master "Default" flag: shown automatically, cannot be unselected or deleted */
  isDefault?: boolean;
  /** row tick used by the group's Delete button */
  selected?: boolean;
}
/** One entry of the QC Defects master for a group (Group / Name / Default / Critical). */
export interface DefectMasterEntry {
  name: string;
  isDefault: boolean;
  critical: boolean;
}
export interface DefectGroup {
  name: string;
  items: DefectItem[];
  /** master list for the "Select Defects" tool; undefined = free-text group (e.g. Other Defects) */
  master?: DefectMasterEntry[];
  collapsed?: boolean;
}
export interface DefectLimits {
  major: number;
  minor: number;
  micro: number;
  total: number;
}
export interface DefectConfig {
  microEnabled: boolean;
  showAcceptedLimit: boolean;
  limits: DefectLimits;
  /** Major/Minor substitution – ratio is NOT documented; config-driven (disabled in mock). */
  substitution: { enabled: boolean; minorsPerMajor: number };
}
export interface DefectData {
  config: DefectConfig;
  /** every group (incl. the final "Other Defects" group) supports Add / Delete */
  groups: DefectGroup[];
}

/* ---------------- Evaluation (Quality / Packing / Measurement results) ---------------- */
export interface Judgement {
  id: string;
  name: string;
}
export interface EvalCheckPoint {
  id: string;
  name: string;
  subName: string;
  judgementId: string | null;
  actualValue: string;
  actualReadonly: boolean;
  comments: string;
}
export interface EvalArea {
  id: string;
  name: string;
  checkPointEnabled: boolean;
  showSubCheckPoint: boolean;
  showActualValue: boolean;
  checkPoints: EvalCheckPoint[];
  judgementEnabled: boolean;
  judgementId: string | null;
  commentEnabled: boolean;
  comments: string;
  attachmentsEnabled: boolean;
  attachments: PhotoAttachment[];
}
export interface EvalGroup {
  id: string;
  name: string;
  checkPointJudgements: Judgement[];
  resultJudgements: Judgement[];
  judgementEnabled: boolean;
  judgementId: string | null;
  areas: EvalArea[];
}

/* ---------------- Final result ---------------- */
export interface FinalQtyRow {
  id: string; // QARequestOrderColorSizeID (+ defect type for second/scrap)
  colorName: string;
  sizeCode: string;
  defectName: string;
  qty: number | null;
}
export interface FinalData {
  captureAccepted: boolean;
  captureSeconds: boolean;
  captureScrap: boolean;
  accepted: FinalQtyRow[];
  seconds: FinalQtyRow[];
  scrap: FinalQtyRow[];
  judgements: Judgement[];
  judgementDate: string; // ISO yyyy-MM-dd
  judgementId: string | null;
  remarks: string;
  attachments: PhotoAttachment[];
  qcSignature: string | null;
  frSignature: string | null;
}

export interface InspectionForm {
  requestId: string;
  orderId: string;
  tranNum: string;
  orderRefNo: string;
  inspectionType: string;
  articleName: string;
  supplierName: string;
  sections: InspectionSection[];
  summary: SummaryData;
  ra: RaRow[];
  measurement: MeasurementData;
  defects: DefectData;
  evaluation: EvalGroup[];
  final: FinalData;
  /** section keys that have been Saved by the user */
  savedSections: string[];
  status: 'draft' | 'submitted';
}

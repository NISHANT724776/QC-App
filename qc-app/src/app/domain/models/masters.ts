import { DefectMasterEntry } from './inspection';

/** Master / reference data used by the QC Add-Ons forms (New Inspection, New Sample Evaluation). */
export interface Color {
  id: string;
  name: string;
  hex: string;
}

export interface Article {
  code: string;
  name: string;
  trans: string;
  category: string;
  buyer: string;
  supplier: string;
  /** two-tone colour used for the card thumbnail (no product images in the mock) */
  hue: [string, string];
}

export interface ProductionOrder {
  pro: string;
  articleCode: string;
  style: string;
  buyer: string;
  department: string;
  season: string;
  supplier: string;
  po: string;
  date: string;
  qty: number;
  offer: number;
}

/** A row of the "Copy from PWN" / "Copy from Existing Inspection" dialog. */
export interface InspectionCopySource {
  key: string;
  articleCode: string;
  inspectionType: string;
  buyer: string;
  supplier: string;
  assignTo: string;
  po: string;
  date: string;
}

export interface SampleOrderSource {
  swn: string;
  articleCode: string;
  buyer: string;
  supplier: string;
  sampleType: string;
  season: string;
}

export interface WorknoteSource {
  swn: string;
  style: string;
  buyer: string;
  department: string;
  season: string;
}

export interface MastersData {
  colors: Color[];
  /** alpha sizes followed by numeric sizes */
  sizes: string[];
  alphaSizeCount: number;
  articles: Article[];
  productionOrders: ProductionOrder[];
  options: Record<string, string[]>;
  pwn: InspectionCopySource[];
  sampleOrders: SampleOrderSource[];
  worknotes: WorknoteSource[];
  /** QC Defects master: group -> entries with Default / Critical flags */
  defectMaster: Record<string, DefectMasterEntry[]>;
  defectGroups: string[];
}

/** An order line while the New Inspection form is being filled (before the request exists). */
export interface DraftOrder {
  po: string;
  pro: string;
  articleCode: string;
  style: string;
  /** total ordered qty of the production order */
  orderQty: number;
  /** colour x size matrices (flat) */
  ordered: number[];
  offered: number[];
}

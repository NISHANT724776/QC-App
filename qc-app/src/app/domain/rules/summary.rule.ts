import { SummaryRow } from '../models/inspection';
import { sampleSizeFor } from './sample-size.rule';

export interface SummaryTotals {
  ordered: number;
  offered: number;
  inspected: number;
  sampleSize: number;
  /** Inspected total − Sample size (BR-S3, inferred: 1 − 3 = −2 in the source screenshots) */
  variance: number;
}

export function summaryTotals(rows: readonly SummaryRow[]): SummaryTotals {
  let ordered = 0;
  let offered = 0;
  let inspected = 0;
  for (const r of rows) {
    ordered += r.ordered || 0;
    offered += r.offered || 0;
    inspected += r.inspected || 0;
  }
  const sampleSize = sampleSizeFor(offered);
  return { ordered, offered, inspected, sampleSize, variance: inspected - sampleSize };
}

/** Parse a user-typed whole number; empty, invalid or negative -> null. */
export function toWholeNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return null;
  return parseInt(t, 10);
}

/** Cartons Inspected = N produces N carton-number inputs (BR-S6). Keeps existing values. */
export function resizeCartonNumbers(current: readonly string[], rawCount: string): string[] {
  const n = Math.min(toWholeNumber(rawCount) ?? 0, 999);
  const next = current.slice(0, n);
  while (next.length < n) next.push('');
  return next;
}

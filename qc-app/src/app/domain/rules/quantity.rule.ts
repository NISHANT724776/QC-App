import { FinalQtyRow } from '../models/inspection';

export function sumQty(rows: readonly FinalQtyRow[]): number {
  return rows.reduce((a, r) => a + (r.qty || 0), 0);
}

/**
 * ASSUMPTION (docs BR-F3 / Q-10): the "Accepted qty mismatch" banner is raised when the accepted
 * quantity total differs from the offered total. The trigger is not documented in the source.
 */
export function acceptedMismatch(accepted: readonly FinalQtyRow[], offeredTotal: number): boolean {
  return sumQty(accepted) !== offeredTotal;
}

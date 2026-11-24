/**
 * Sample size from lot (offered) quantity.
 *
 * ASSUMPTION (docs BR-S4 / Q-5): the source app showed Sample Size = 3 for an offered quantity
 * of 12 with Standard 1.5. That matches ISO 2859-1 / ANSI Z1.4 "General Inspection Level II"
 * (lot 9–15 -> code letter B -> sample 3), so that table is used here. Replace this single
 * function if the business supplies a different lookup.
 */
const LEVEL_II: ReadonlyArray<{ max: number; sample: number }> = [
  { max: 8, sample: 2 },
  { max: 15, sample: 3 },
  { max: 25, sample: 5 },
  { max: 50, sample: 8 },
  { max: 90, sample: 13 },
  { max: 150, sample: 20 },
  { max: 280, sample: 32 },
  { max: 500, sample: 50 },
  { max: 1200, sample: 80 },
  { max: 3200, sample: 125 },
  { max: 10000, sample: 200 },
  { max: 35000, sample: 315 },
  { max: 150000, sample: 500 },
  { max: 500000, sample: 800 },
  { max: Number.POSITIVE_INFINITY, sample: 1250 },
];

export function sampleSizeFor(lotQty: number): number {
  if (!lotQty || lotQty <= 0) return 0;
  const row = LEVEL_II.find((r) => lotQty <= r.max)!;
  return Math.min(row.sample, lotQty);
}

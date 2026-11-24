/**
 * Colour x size quantity matrices are flat arrays: index = colour * sizeCount + size.
 * (Same representation as the Add-Ons prototype's "Color/Size Details" grid.)
 */
export const sumOf = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

/** Largest-remainder split of `total` according to `weights` (always sums exactly to total). */
export function distribute(weights: readonly number[], total: number): number[] {
  const tw = sumOf(weights);
  if (!tw || !total) return weights.map(() => 0);
  const exact = weights.map((w) => (w * total) / tw);
  const floor = exact.map(Math.floor);
  const rem = total - sumOf(floor);
  const order = exact.map((e, i) => [e - floor[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < rem; k++) floor[order[k][1]]++;
  return floor;
}

/** Deterministic mock ordered matrix for an order of `total` pieces. */
export function generateOrdered(total: number, seed: number, colorWeights: readonly number[], sizeWeights: readonly number[]): number[] {
  const w: number[] = [];
  for (let c = 0; c < colorWeights.length; c++) {
    for (let s = 0; s < sizeWeights.length; s++) {
      w.push((c * 7 + s * 3) % 11 === 0 ? 0 : colorWeights[c] * sizeWeights[s] * (1 + ((c * 13 + s * 5 + seed) % 7) / 20));
    }
  }
  return distribute(w, total);
}

/** Cells whose offered qty is above the ordered qty (not allowed – "Offer qty cannot exceed ordered qty"). */
export function overOrdered(offered: readonly number[], ordered: readonly number[]): number {
  return offered.filter((v, i) => v > (ordered[i] ?? 0)).length;
}

/** Whole-number parse used by every matrix cell (digits only). */
export function cellValue(raw: string): number {
  return parseInt(raw.replace(/[^0-9]/g, '') || '0', 10);
}

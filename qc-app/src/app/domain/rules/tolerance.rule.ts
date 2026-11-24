import { parseFraction } from './fraction.rule';

export type ToleranceResult = 'empty' | 'ok' | 'out' | 'invalid';

/**
 * An actual outside (Required − negative tol) … (Required + positive tol) is flagged
 * (red in the source app, BR-M3). Bounds are inclusive (assumption – docs Q-7).
 */
export function evaluateTolerance(
  actual: string,
  required: string,
  tolPositive: string,
  tolNegative: string,
): ToleranceResult {
  if (!actual || !actual.trim()) return 'empty';
  const a = parseFraction(actual);
  if (a === null) return 'invalid';
  const r = parseFraction(required);
  if (r === null) return 'ok';
  const pos = Math.abs(parseFraction(tolPositive) ?? 0);
  const neg = Math.abs(parseFraction(tolNegative) ?? 0);
  const eps = 1e-9;
  return a > r + pos + eps || a < r - neg - eps ? 'out' : 'ok';
}

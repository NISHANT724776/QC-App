/**
 * Fractional-inch helpers. Measurement values in the source app are fractional inches
 * ("22 1/2", "1/4", "3/8"). Decimal input is also accepted (assumption – see docs Q-7).
 */
export function parseFraction(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return null;
  const sign = s.startsWith('-') ? -1 : 1;
  const body = s.replace(/^[-+]/, '');
  // "a b/c"
  let m = /^(\d+) (\d+)\/(\d+)$/.exec(body);
  if (m) return +m[3] !== 0 ? sign * (+m[1] + +m[2] / +m[3]) : null;
  // "b/c"
  m = /^(\d+)\/(\d+)$/.exec(body);
  if (m) return +m[2] !== 0 ? sign * (+m[1] / +m[2]) : null;
  // "12" or "12.5"
  if (/^\d+(\.\d+)?$/.test(body)) return sign * parseFloat(body);
  return null;
}

/** Format a number as a mixed fraction to the nearest 1/8 (used for generated mock data). */
export function formatFraction(value: number, denominator = 8): string {
  const sign = value < 0 ? '-' : '';
  const v = Math.abs(value);
  const total = Math.round(v * denominator);
  const whole = Math.floor(total / denominator);
  let num = total % denominator;
  if (num === 0) return `${sign}${whole}`;
  let d = denominator;
  const g = gcd(num, d);
  num /= g;
  d /= g;
  return whole > 0 ? `${sign}${whole} ${num}/${d}` : `${sign}${num}/${d}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

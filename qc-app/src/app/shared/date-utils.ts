/** Local-date helpers (all dates in the app are plain `yyyy-MM-dd` strings – no time zones). */
export const pad = (n: number) => String(n).padStart(2, '0');

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

export function addMonths(iso: string, months: number): string {
  const d = fromIso(iso);
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return toIso(d);
}

export type RangeMode = 'all' | 'day' | 'week' | 'month';

/**
 * Day = the date; Week = 7 days ending on the anchor (the source app showed Nov 07 – Nov 13 for
 * anchor Nov 13); Month = the calendar month of the anchor.
 */
export function rangeFor(mode: RangeMode, anchor: string): { from: string | null; to: string | null } {
  switch (mode) {
    case 'all':
      return { from: null, to: null };
    case 'day':
      return { from: anchor, to: anchor };
    case 'week':
      return { from: addDays(anchor, -6), to: anchor };
    case 'month': {
      const d = fromIso(anchor);
      return { from: toIso(new Date(d.getFullYear(), d.getMonth(), 1)), to: toIso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
    }
  }
}

export function shiftAnchor(mode: RangeMode, anchor: string, dir: 1 | -1): string {
  switch (mode) {
    case 'day':
      return addDays(anchor, dir);
    case 'week':
      return addDays(anchor, dir * 7);
    case 'month':
      return addMonths(anchor, dir);
    default:
      return anchor;
  }
}

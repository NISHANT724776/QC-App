import { DefectConfig, DefectItem } from '../models/inspection';

export interface DefectTotals {
  major: number;
  minor: number;
  micro: number;
  total: number;
  eqMajor: number;
  eqMinor: number;
  eqTotal: number;
}

export function defectTotals(items: readonly DefectItem[], config: DefectConfig): DefectTotals {
  let major = 0;
  let minor = 0;
  let micro = 0;
  for (const d of items) {
    major += d.major || 0;
    minor += d.minor || 0;
    micro += config.microEnabled ? d.micro || 0 : 0;
  }
  const total = major + minor + micro;
  let eqMajor = major;
  let eqMinor = minor;
  if (config.substitution.enabled && config.substitution.minorsPerMajor > 0) {
    // ASSUMPTION (docs BR-D4 / Q-6): N minors are equivalent to 1 major. Disabled in mock config.
    eqMajor = major + Math.floor(minor / config.substitution.minorsPerMajor);
    eqMinor = minor % config.substitution.minorsPerMajor;
  }
  return { major, minor, micro, total, eqMajor, eqMinor, eqTotal: eqMajor + eqMinor };
}

/** Warn-only (docs Q-6): flags where actuals exceed the configured acceptable limit. */
export function overLimit(totals: DefectTotals, config: DefectConfig) {
  const l = config.limits;
  return {
    major: totals.major > l.major,
    minor: totals.minor > l.minor,
    micro: config.microEnabled && totals.micro > l.micro,
    total: totals.total > l.total,
  };
}

export function clampCount(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

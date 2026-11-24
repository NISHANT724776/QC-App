import { describe, expect, it } from 'vitest';
import { formatFraction, parseFraction } from './fraction.rule';
import { evaluateTolerance } from './tolerance.rule';
import { sampleSizeFor } from './sample-size.rule';
import { resizeCartonNumbers, summaryTotals, toWholeNumber } from './summary.rule';
import { defectTotals, overLimit } from './defect.rule';
import { DefectConfig, DefectItem, SummaryRow } from '../models/inspection';

const cfg = (over: Partial<DefectConfig> = {}): DefectConfig => ({
  microEnabled: false,
  showAcceptedLimit: true,
  limits: { major: 0, minor: 0, micro: 0, total: 0 },
  substitution: { enabled: false, minorsPerMajor: 3 },
  ...over,
});
const d = (major: number, minor: number, micro = 0): DefectItem => ({
  id: 'x',
  name: 'x',
  critical: false,
  comments: '',
  major,
  minor,
  micro,
  photos: [],
});

describe('fraction rule', () => {
  it('parses mixed, simple and decimal values', () => {
    expect(parseFraction('22 1/2')).toBe(22.5);
    expect(parseFraction('1/4')).toBe(0.25);
    expect(parseFraction('3/8')).toBe(0.375);
    expect(parseFraction('2')).toBe(2);
    expect(parseFraction('20.5')).toBe(20.5);
    expect(parseFraction(' 16  1/4 ')).toBe(16.25);
  });
  it('rejects invalid input', () => {
    expect(parseFraction('abc')).toBeNull();
    expect(parseFraction('1/0')).toBeNull();
    expect(parseFraction('')).toBeNull();
  });
  it('formats to nearest eighth', () => {
    expect(formatFraction(22.5)).toBe('22 1/2');
    expect(formatFraction(0.375)).toBe('3/8');
    expect(formatFraction(2)).toBe('2');
  });
});

describe('tolerance rule (BR-M3, from screenshots)', () => {
  it('flags 10 against 22 1/2 +/- 1/4 as out', () => {
    expect(evaluateTolerance('10', '22 1/2', '1/4', '1/4')).toBe('out');
  });
  it('accepts 20 1/2 against 20 1/2', () => {
    expect(evaluateTolerance('20 1/2', '20 1/2', '1/4', '1/4')).toBe('ok');
  });
  it('is inclusive at the boundary', () => {
    expect(evaluateTolerance('22 3/4', '22 1/2', '1/4', '1/4')).toBe('ok');
    expect(evaluateTolerance('22 7/8', '22 1/2', '1/4', '1/4')).toBe('out');
  });
  it('handles empty and invalid', () => {
    expect(evaluateTolerance('', '2', '1/8', '1/8')).toBe('empty');
    expect(evaluateTolerance('x', '2', '1/8', '1/8')).toBe('invalid');
  });
});

describe('summary rule (BR-S2..S6, from screenshots)', () => {
  const data: [string, number, number, number][] = [
    ['XS', 3, 3, 0],
    ['S', 4, 4, 1],
    ['M', 2, 2, 0],
    ['L', 1, 1, 0],
    ['XL', 1, 1, 0],
    ['XXL', 1, 1, 0],
  ];
  const rows: SummaryRow[] = data.map(([s, o, f, i]) => ({
    id: s,
    colorName: 'WHITE',
    colorCode: 'WHITE',
    sizeCode: s,
    ordered: o,
    offered: f,
    inspected: i,
  }));
  it('reproduces total 12/1, sample size 3 and variance -2', () => {
    const t = summaryTotals(rows);
    expect(t.offered).toBe(12);
    expect(t.inspected).toBe(1);
    expect(t.sampleSize).toBe(3);
    expect(t.variance).toBe(-2);
  });
  it('sample size table', () => {
    expect(sampleSizeFor(0)).toBe(0);
    expect(sampleSizeFor(1)).toBe(1);
    expect(sampleSizeFor(500)).toBe(50);
    expect(sampleSizeFor(501)).toBe(80);
  });
  it('whole numbers only', () => {
    expect(toWholeNumber('12')).toBe(12);
    expect(toWholeNumber('1.5')).toBeNull();
    expect(toWholeNumber('-1')).toBeNull();
  });
  it('cartons inspected = 4 gives 4 inputs and keeps values', () => {
    const a = resizeCartonNumbers([], '4');
    expect(a.length).toBe(4);
    a[0] = 'C-01';
    expect(resizeCartonNumbers(a, '2')).toEqual(['C-01', '']);
    expect(resizeCartonNumbers(a, '')).toEqual([]);
  });
});

describe('defect rule (BR-D3..D5, from screenshots)', () => {
  it('Actual 1 major / 1 minor / total 2 against limit 0', () => {
    const t = defectTotals([d(1, 0), d(0, 1)], cfg());
    expect(t).toMatchObject({ major: 1, minor: 1, total: 2 });
    expect(overLimit(t, cfg())).toMatchObject({ major: true, minor: true, total: true });
  });
  it('ignores micro when not enabled', () => {
    expect(defectTotals([d(0, 0, 5)], cfg()).total).toBe(0);
    expect(defectTotals([d(0, 0, 5)], cfg({ microEnabled: true })).total).toBe(5);
  });
  it('applies substitution only when enabled', () => {
    const c = cfg({ substitution: { enabled: true, minorsPerMajor: 3 } });
    const t = defectTotals([d(1, 7)], c);
    expect(t.eqMajor).toBe(3);
    expect(t.eqMinor).toBe(1);
    expect(t.eqTotal).toBe(4);
  });
});

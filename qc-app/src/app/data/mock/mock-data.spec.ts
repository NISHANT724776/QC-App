import { describe, expect, it } from 'vitest';
import { buildForm, buildRequests } from './mock-data';
import { summaryTotals } from '../../domain/rules/summary.rule';
import { evaluateTolerance } from '../../domain/rules/tolerance.rule';
import { defectTotals } from '../../domain/rules/defect.rule';

/**
 * Conformance of the seeded data with the SOURCE SCREENSHOTS (WFXQC-ScreenShot.docx).
 * Each expectation cites the screenshot it comes from.
 */
const reqs = buildRequests();
const form = (reqId: string, orderId: string) => buildForm(reqs.find((r) => r.qaRequestId === reqId)!, orderId);

describe('request list data (screenshots 3, 7, 25-27)', () => {
  it('has IR-7300 / IR-7302 / IR-7303 FINAL INSPECTION for the article and supplier shown', () => {
    for (const n of ['IR-7300', 'IR-7302', 'IR-7303']) {
      const r = reqs.find((x) => x.tranNum === n)!;
      expect(r.inspectionType).toBe('FINAL INSPECTION');
      expect(r.articleCode + r.buyerRef).toBe('KHW031105-101 / KHW031105-101');
      expect(r.articleName).toBe('W SPRING CLASSICS 26 - SYRIL SPLIT BACK TEE');
      expect(r.supplierName).toBe('Topy Top S.A');
    }
  });
  it('dates group as Nov 02 / Nov 13 / Nov 14 2026', () => {
    expect(['IR-7300', 'IR-7302', 'IR-7303'].map((n) => reqs.find((r) => r.tranNum === n)!.date)).toEqual(['2026-11-02', '2026-11-13', '2026-11-14']);
  });
  it('order 114081 has order/offer qty 12.0 and two request-level PDF attachments', () => {
    const o = reqs.find((r) => r.tranNum === 'IR-7300')!.orders[0];
    expect(o.orderRefNo).toBe('114081');
    expect(o.orderQty).toBe(12);
    expect(o.offeredQty).toBe(12);
    expect(reqs.find((r) => r.tranNum === 'IR-7300')!.attachments.length).toBe(2);
  });
  it('requests start Active and unsynced (grey dot, no sync icon)', () => {
    for (const n of ['IR-7300', 'IR-7302', 'IR-7303']) {
      const r = reqs.find((x) => x.tranNum === n)!;
      expect(r.status).toBe('Active');
      expect(r.orders.every((o) => !o.isCompleted && o.syncState === 'none')).toBe(true);
    }
  });
});

describe('inspection form sections and order (screenshot 8: tab strip)', () => {
  const f = form('qr-7302', 'qo-114081-a');
  it('tab order matches the source', () => {
    expect(f.sections.map((s) => s.label)).toEqual([
      'Summary Page', 'RA Sheet', 'Measurement Evaluation', 'Measurement Results', 'Defect Capturing', 'Quality Results', 'Packing Results', 'Final Result',
    ]);
  });
});

describe('summary data (screenshots 8, 28, 45)', () => {
  const f = form('qr-7302', 'qo-114081-a');
  it('colour WHITE, sizes XS..XXL with ordered 3,4,2,1,1,1 and offered = ordered', () => {
    expect(f.summary.rows.map((r) => [r.sizeCode, r.ordered, r.offered])).toEqual([['XS', 3, 3], ['S', 4, 4], ['M', 2, 2], ['L', 1, 1], ['XL', 1, 1], ['XXL', 1, 1]]);
    expect(f.summary.rows.every((r) => r.colorName === 'WHITE')).toBe(true);
  });
  it('standard defaults to 1.5; totals 12 offered, sample 3', () => {
    expect(f.summary.originalStandard).toBe('1.5');
    const t = summaryTotals(f.summary.rows);
    expect(t.offered).toBe(12);
    expect(t.sampleSize).toBe(3);
  });
});

describe('RA sheet (screenshots 9, 29, 46)', () => {
  const f = form('qr-7302', 'qo-114081-a');
  it('has the 8 activities in order', () => {
    expect(f.ra.map((r) => r.activity)).toEqual(['Route', 'Cutting', 'Sewing', 'Print', 'Embroidery', 'Laundry/Dye', 'FInishing', 'Fabric']);
  });
  it('only Sewing carries a risk', () => {
    expect(f.ra.filter((r) => r.risk).map((r) => r.activity)).toEqual(['Sewing']);
    expect(f.ra.find((r) => r.activity === 'Sewing')!.risk).toBe('PIEZA ESPALDA-ESCOTE ESPALDA');
  });
});

describe('measurement (screenshots 10, 30, 47)', () => {
  const f = form('qr-7302', 'qo-114081-a');
  const xs = f.measurement.sizes[0];
  it('size tabs XS, S, M, L, XL, XXL', () => {
    expect(f.measurement.sizes.map((s) => s.sizeCode)).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
  });
  it('XS POM rows, required values and tolerances match the screenshot', () => {
    const rows = xs.poms.slice(0, 7).map((p) => [p.code, p.required, p.tolPositive, p.tolNegative]);
    expect(rows).toEqual([
      ['POM/1572', '22 1/2', '1/4', '1/4'],
      ['POM/1705', '20 1/2', '1/4', '1/4'],
      ['POM/90', '1/2', '1/8', '1/8'],
      ['POM/91', '2', '1/8', '1/8'],
      ['POM/396', '18', '3/8', '3/8'],
      ['POM/1698', '16 1/4', '3/8', '3/8'],
      ['POM/211', '17', '3/8', '3/8'],
    ]);
    expect(xs.poms[0].name).toBe('FRONT BODY LENGTH FROM HPS TO BOTTOM EDGE');
  });
  it('screenshot values: 10 is out of tolerance (red), 20 1/2 is fine', () => {
    const [a, b] = xs.poms;
    expect(evaluateTolerance('10', a.required, a.tolPositive, a.tolNegative)).toBe('out');
    expect(evaluateTolerance('20 1/2', b.required, b.tolPositive, b.tolNegative)).toBe('ok');
  });
  it('POM names keep the escaped inch mark exactly as the screenshot shows it (6\\")', () => {
    expect(xs.poms[5].name).toBe('ACROSS FRONT 6\\" FROM HPS');
    expect(xs.poms[6].name).toBe('ACROSS BACK 6\\" BELOW HPS');
  });
  it('colour list is WHITE; first sample colour preselected', () => {
    expect(f.measurement.colors).toEqual(['WHITE']);
    expect(xs.samples[0].color).toBe('WHITE');
  });
});

describe('defects (screenshots 12, 33, 49)', () => {
  const f = form('qr-7302', 'qo-114081-a');
  it('APPEARANCE group starts with the 7 listed defects in order', () => {
    const g = f.defects.groups[0];
    expect(g.name).toBe('APPEARANCE');
    expect(g.items.slice(0, 7).map((d) => d.name)).toEqual([
      'NECKLINE OPENINGS', 'ASYMMETRICAL CUFF', 'ASYMMETRICAL LEGS', 'ASYMMETRICAL POCKET', 'ASYMMETRICAL VENTS', 'SPOTS', 'SEAM OVER PRESSED',
    ]);
  });
  it('all counters start at 0 and Ac. Limit is 0/0/0 with limits shown, micro off', () => {
    const all = f.defects.groups.flatMap((g) => g.items);
    expect(all.every((d) => d.major === 0 && d.minor === 0 && d.micro === 0)).toBe(true);
    expect(f.defects.config.limits).toEqual({ major: 0, minor: 0, micro: 0, total: 0 });
    expect(f.defects.config.showAcceptedLimit).toBe(true);
    expect(f.defects.config.microEnabled).toBe(false);
  });
  it('screenshot state (1 major + 1 minor) gives actual 1 / 1 / 2', () => {
    const items = f.defects.groups[0].items.map((d) => ({ ...d }));
    items[0].major = 1;
    items[1].minor = 1;
    expect(defectTotals(items, f.defects.config)).toMatchObject({ major: 1, minor: 1, total: 2 });
  });
});

describe('evaluation groups (screenshots 11, 19, 20, 34, 35, 55, 56)', () => {
  const f = form('qr-7302', 'qo-114081-a');
  const area = (g: string, a: string) => f.evaluation.find((x) => x.id === g)!.areas.find((x) => x.id === a)!;
  it('Quality Checklist items', () => {
    expect(area('eg-quality', 'ea-quality').checkPoints.map((c) => c.name)).toEqual([
      'Zipper', 'Snaps', 'Slider', 'Size label', 'Main label', 'Hanger loop', 'Eyelets', 'Extra button/Botón extra', 'Drawcord', 'Care Label', 'Buttons',
    ]);
  });
  it('Packing: Folding / Trims / Cartons areas and items', () => {
    const g = f.evaluation.find((x) => x.id === 'eg-packing')!;
    expect(g.areas.map((a) => a.name)).toEqual(['Folding', 'Trims', 'Cartons']);
    expect(area('eg-packing', 'ea-folding').checkPoints.map((c) => c.name)).toEqual(['Tissue Paper/Papel Tissue', 'Correct Folding', 'Carton']);
    expect(area('eg-packing', 'ea-trims').checkPoints.map((c) => c.name)).toEqual(['Swiftack', 'Price', 'Main Hangtag/Etiqueta Principal', 'Barcode']);
    expect(area('eg-packing', 'ea-cartons').checkPoints.map((c) => c.name)).toEqual([
      'Tape', 'Straps', 'Sticker', 'Short Side Marking', 'Long Side Marking', 'Include PL in the carton', 'Check all Carton Number', 'Barcode',
    ]);
  });
  it('checkpoint choices are Confirmed / No Confirmed; results Approved / Rejected', () => {
    const g = f.evaluation[1];
    expect(g.checkPointJudgements.map((j) => j.name)).toEqual(['Confirmed', 'No Confirmed']);
    expect(g.resultJudgements.map((j) => j.name)).toEqual(['Approved', 'Rejected']);
  });
  it('Measurement Results: empty checkpoint list, comments box, Result preset to Approved', () => {
    const g = f.evaluation[0];
    expect(g.areas[0].checkPoints).toEqual([]);
    expect(g.areas[0].commentEnabled).toBe(true);
    expect(g.judgementId).toBe('r-approved');
  });
  it('photo strips exist on Quality and Cartons (screenshots 20, 35, 55, 56)', () => {
    expect(area('eg-quality', 'ea-quality').attachmentsEnabled).toBe(true);
    expect(area('eg-packing', 'ea-cartons').attachmentsEnabled).toBe(true);
  });
});

describe('final result (screenshots 21, 36, 57; XAML capture flags)', () => {
  it('standard order: no quantity capture blocks', () => {
    const f = form('qr-7302', 'qo-114081-a').final;
    expect([f.captureAccepted, f.captureSeconds, f.captureScrap]).toEqual([false, false, false]);
  });
  it('flagged order exposes accepted/second/scrap grids', () => {
    const f = form('qr-7303', 'qo-114083').final;
    expect([f.captureAccepted, f.captureSeconds, f.captureScrap]).toEqual([true, true, true]);
    expect(f.accepted.length).toBe(4); // 4 sizes
    expect(f.seconds.length).toBe(8); // 2 defect types x 4 sizes
  });
  it('judgement date defaults to today, judgement unset, no signatures', () => {
    const f = form('qr-7302', 'qo-114081-a').final;
    expect(f.judgementDate).toBe(new Date().toISOString().slice(0, 10));
    expect(f.judgementId).toBeNull();
    expect(f.qcSignature).toBeNull();
    expect(f.frSignature).toBeNull();
  });
});

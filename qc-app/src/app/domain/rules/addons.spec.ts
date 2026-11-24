import { describe, expect, it } from 'vitest';
import { buildForm } from '../../data/mock/mock-data';
import { MASTERS } from '../../data/mock/mock-masters';
import { DefectGroup, InspectionForm } from '../models/inspection';
import { InspectionRequest } from '../models/request';
import { applyMasterSelection, criticalEditable, deleteSelected, initialSelection, newManualDefect, normalizeDefects, toggleCritical } from './defect-groups.rule';
import { cellValue, distribute, generateOrdered, overOrdered, sumOf } from './matrix.rule';

describe('matrix rule (Offer qty / colour-size grid)', () => {
  it('distribute always sums exactly to the total', () => {
    for (const total of [0, 1, 7, 100, 13428]) {
      const d = distribute([3.2, 2.6, 0, 1.1, 0.4], total);
      expect(sumOf(d)).toBe(total);
      expect(d[2]).toBe(0);
    }
  });
  it('generated ordered matrix matches the order qty and the 10 x 25 shape', () => {
    const ordered = generateOrdered(13428, 29, [3.2, 2.6, 2.2, 1.2, 1, 1.6, 0.9, 0.7, 0.8, 1.1], new Array(25).fill(1));
    expect(ordered.length).toBe(250);
    expect(sumOf(ordered)).toBe(13428);
  });
  it('offer above ordered is flagged (not allowed)', () => {
    expect(overOrdered([3, 5, 0], [3, 4, 0])).toBe(1);
    expect(overOrdered([3, 4, 0], [3, 4, 0])).toBe(0);
  });
  it('cell values are whole numbers only', () => {
    expect(cellValue('1a2')).toBe(12);
    expect(cellValue('')).toBe(0);
  });
});

describe('defect groups (requirements doc – group-wise Add, Default, Select Defects, Critical)', () => {
  const master = { name: 'POOR IRONING', isDefault: false, critical: false };
  const group = (): DefectGroup => ({
    name: 'APPEARANCE',
    master: [
      { name: 'ASYMMETRICAL SLEEVES', isDefault: true, critical: true },
      { name: 'UNEVEN SHOULDER', isDefault: true, critical: false },
      master,
      { name: 'WRINKLE MARKS', isDefault: false, critical: true },
    ],
    items: [
      { ...newManualDefect('a'), name: 'ASYMMETRICAL SLEEVES', fromMaster: true, isDefault: true, critical: true },
      { ...newManualDefect('b'), name: 'UNEVEN SHOULDER', fromMaster: true, isDefault: true },
    ],
  });

  it('Select Defects: default entries are pre-ticked and locked, picking adds with the master Critical flag', () => {
    const g = group();
    const sel = initialSelection(g);
    expect([...sel].sort()).toEqual(['ASYMMETRICAL SLEEVES', 'UNEVEN SHOULDER']);
    sel.add('WRINKLE MARKS');
    sel.add('POOR IRONING');
    const r = applyMasterSelection(g, sel, () => 'x' + Math.random());
    expect(r.added).toBe(2);
    const w = r.group.items.find((d) => d.name === 'WRINKLE MARKS')!;
    expect(w.critical).toBe(true);
    expect(w.fromMaster && !w.isDefault).toBe(true);
  });
  it('Select Defects: unticking removes non-default rows but never default ones', () => {
    const g = applyMasterSelection(group(), new Set(['ASYMMETRICAL SLEEVES', 'UNEVEN SHOULDER', 'POOR IRONING'])).group;
    const r = applyMasterSelection(g, new Set()); // untick everything
    expect(r.removed).toBe(1);
    expect(r.group.items.map((d) => d.name)).toEqual(['ASYMMETRICAL SLEEVES', 'UNEVEN SHOULDER']);
  });
  it('Critical column: starts from the master flag and can be toggled on master rows and manual rows', () => {
    const m = group().items[1];
    expect(m.critical).toBe(false);
    expect(criticalEditable(m)).toBe(true);
    expect(toggleCritical(m).critical).toBe(true);
    const manual = newManualDefect('z');
    expect(criticalEditable(manual)).toBe(true);
    expect(toggleCritical(manual).critical).toBe(true);
    expect(toggleCritical(toggleCritical(manual)).critical).toBe(false);
  });
  it('Delete removes ticked manual / non-default rows and keeps Default rows', () => {
    const g = group();
    g.items.push({ ...newManualDefect('m1'), name: 'LOOSE THREADS', selected: true });
    g.items[0].selected = true; // default row ticked – cannot be deleted
    const r = deleteSelected(g);
    expect(r.removed.map((d) => d.id)).toEqual(['m1']);
    expect(r.group.items.length).toBe(2);
  });
  it('legacy forms (separate "others" list) are migrated into a final OTHER DEFECTS group', () => {
    const legacy = {
      defects: {
        config: { microEnabled: false, showAcceptedLimit: true, limits: { major: 0, minor: 0, micro: 0, total: 0 }, substitution: { enabled: false, minorsPerMajor: 3 } },
        groups: [{ name: 'APPEARANCE', items: [{ ...newManualDefect('a'), name: 'X' }] }],
        others: [{ ...newManualDefect('o'), name: 'CUSTOM' }],
      },
    } as unknown as InspectionForm;
    const f = normalizeDefects(legacy);
    expect(f.defects.groups.at(-1)!.name).toBe('OTHER DEFECTS');
    expect(f.defects.groups.at(-1)!.items.map((d) => d.name)).toEqual(['CUSTOM']);
    expect((f.defects as unknown as { others?: unknown }).others).toBeUndefined();
  });
});

describe('result form built from an Add-Ons order (colour x size matrix + QC defects master)', () => {
  const ns = MASTERS.sizes.length;
  const ordered = new Array(MASTERS.colors.length * ns).fill(0);
  const offered = new Array(ordered.length).fill(0);
  // Dark Navy: sizes M and L ; Black: size S
  ordered[0 * ns + 3] = 10; offered[0 * ns + 3] = 8; // Dark Navy M
  ordered[0 * ns + 4] = 6; offered[0 * ns + 4] = 6;  // Dark Navy L
  ordered[1 * ns + 2] = 4; offered[1 * ns + 2] = 4;  // Black S
  const req = {
    qaRequestId: 'qr-ir-7400', tranNum: 'IR-7400', inspectionType: 'FINAL INSPECTION', articleCode: '79944', buyerRef: ' / TRX-88123',
    articleName: 'NB SURPLICE MINI DRESS', supplierName: 'SHIVANK UDYOG LTD.', imageUrl: null, date: '2026-11-17', styleCount: 1, isInspectionCancel: false,
    isExpanderEnable: true, comment: '', attachments: [], status: 'Active', kind: 'inspection',
    orders: [{ qaRequestOrderId: 'qo-x', orderRefNo: '396773', styleName: 'NB Surplice Mini Dress', colorName: 'Dark Navy, Black', orderQty: 20, offeredQty: 18, actualOfferedQty: null, acceptedQty: null, deliveryDate: '2026-11-17', status: null, syncState: 'none', isCompleted: false, matrix: { ordered, offered } }],
  } as InspectionRequest;
  const f = buildForm(req, 'qo-x');

  it('summary rows come from the matrix (only offered cells)', () => {
    expect(f.summary.rows.map((r) => [r.colorName, r.sizeCode, r.ordered, r.offered])).toEqual([
      ['DARK NAVY', 'M', 10, 8], ['DARK NAVY', 'L', 6, 6], ['BLACK', 'S', 4, 4],
    ]);
  });
  it('measurement sizes and colours follow the order', () => {
    expect(f.measurement.sizes.map((s) => s.sizeCode)).toEqual(['S', 'M', 'L']);
    expect(f.measurement.colors).toEqual(['DARK NAVY', 'BLACK']);
  });
  it('defect groups come from the master: only Default entries are shown, Critical from master, Other Defects last', () => {
    expect(f.defects.groups.map((g) => g.name)).toEqual(['APPEARANCE', 'FABRIC & MATERIAL', 'TRIMMINGS & ACCESSORIES', 'PACKING', 'LABEL & TAG', 'OTHER DEFECTS']);
    const app = f.defects.groups[0];
    expect(app.items.map((d) => d.name)).toEqual(['ASYMMETRICAL SLEEVES', 'UNEVEN SHOULDER']);
    expect(app.items.map((d) => d.critical)).toEqual([true, false]);
    expect(app.master!.length).toBe(8);
    expect(f.defects.groups.at(-1)!.master).toBeUndefined();
  });
});

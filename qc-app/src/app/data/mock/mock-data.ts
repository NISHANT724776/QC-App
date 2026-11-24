import {
  DefectItem,
  EvalArea,
  EvalCheckPoint,
  EvalGroup,
  FinalQtyRow,
  InspectionForm,
  InspectionSection,
  Judgement,
  MeasurementPom,
  MeasurementSize,
  RaRow,
  SummaryRow,
} from '../../domain/models/inspection';
import { InspectionRequest, OrderLine } from '../../domain/models/request';
import { formatFraction, parseFraction } from '../../domain/rules/fraction.rule';
import { DefectGroup } from '../../domain/models/inspection';
import { distribute, generateOrdered } from '../../domain/rules/matrix.rule';
import { MASTERS } from './mock-masters';

/**
 * MOCK DATA – seeded from the source screenshots (IR-7300/7302/7303, order 114081, the POM list,
 * defect list, checklists). Values not visible in the screenshots (other sizes' grading, extra
 * defects, second/scrap defect types) are plausible placeholders.
 */
const uid = (p: string, n: string | number) => `${p}-${n}`;

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

interface OrderSpec {
  qaRequestOrderId: string;
  orderRefNo: string;
  styleName: string;
  colorName: string;
  colorCode: string;
  qty: Record<string, number>;
  deliveryDate: string;
  captures: boolean;
}

const ORDERS: Record<string, OrderSpec> = {
  'qo-114081-a': {
    qaRequestOrderId: 'qo-114081-a', orderRefNo: '114081', styleName: '', colorName: 'WHITE', colorCode: 'WHITE',
    qty: { XS: 3, S: 4, M: 2, L: 1, XL: 1, XXL: 1 }, deliveryDate: '2026-11-13', captures: false,
  },
  'qo-114081-b': {
    qaRequestOrderId: 'qo-114081-b', orderRefNo: '114081', styleName: '', colorName: 'WHITE', colorCode: 'WHITE',
    qty: { XS: 3, S: 4, M: 2, L: 1, XL: 1, XXL: 1 }, deliveryDate: '2026-11-02', captures: false,
  },
  'qo-114083': {
    qaRequestOrderId: 'qo-114083', orderRefNo: '114083', styleName: 'SYRIL SPLIT BACK TEE', colorName: 'WHITE', colorCode: 'WHITE',
    qty: { XS: 2, S: 3, M: 3, L: 2 }, deliveryDate: '2026-11-14', captures: true,
  },
  'qo-114084': {
    qaRequestOrderId: 'qo-114084', orderRefNo: '114084', styleName: 'SYRIL SPLIT BACK TEE - BLACK', colorName: 'BLACK', colorCode: 'BLACK',
    qty: { M: 4, L: 4 }, deliveryDate: '2026-11-14', captures: true,
  },
  'qo-113950': {
    qaRequestOrderId: 'qo-113950', orderRefNo: '113950', styleName: 'CORE POLO', colorName: 'NAVY', colorCode: 'NAVY',
    qty: { S: 8, M: 8, L: 8 }, deliveryDate: '2026-10-30', captures: false,
  },
};

const total = (q: Record<string, number>) => Object.values(q).reduce((a, b) => a + b, 0);

const PDF_ATTACHMENTS = [
  { id: 'at-1', userFileName: 'khw031105-split-back-tee-pps-comments-ACTUALIZADO 12-09-25.pdf', fileUrl: 'mock://pps-comments' },
  { id: 'at-2', userFileName: 'khw031105-syril-split-back-tee-72928-2025-09-10-1146-595222 TOP-10-09-25.pdf', fileUrl: 'mock://tech-pack' },
];

function orderLine(spec: OrderSpec): OrderLine {
  const t = total(spec.qty);
  return {
    qaRequestOrderId: spec.qaRequestOrderId,
    orderRefNo: spec.orderRefNo,
    styleName: spec.styleName,
    colorName: `${spec.colorName} (${spec.colorCode})`,
    orderQty: t,
    offeredQty: t,
    actualOfferedQty: null,
    acceptedQty: null,
    deliveryDate: spec.deliveryDate,
    status: null,
    syncState: 'none',
    isCompleted: false,
  };
}

/* ---------------------------------------------------------------- Add-Ons seed data (matrix orders, sample evaluations) */
const SEED_COLOR_W = [3.2, 2.6, 2.2, 1.2, 1.0, 1.6, 0.9, 0.7, 0.8, 1.1];
const SEED_SIZE_W = [0.3, 0.8, 1.6, 2.2, 2.0, 1.4, 0.9, 0.4, 0.2, 0.1, 0.2, 0.5, 0.9, 1.3, 1.5, 1.4, 1.1, 0.8, 0.5, 0.35, 0.2, 0.12, 0.08, 0.05, 0.03];

function seedOrder(tran: string, index: number, po: string, delivery: string, completed = false): OrderLine {
  const p = MASTERS.productionOrders.find((x) => x.po === po)!;
  const ordered = generateOrdered(p.qty, parseInt(p.po.slice(-2), 10) || 1, SEED_COLOR_W, SEED_SIZE_W);
  const offered = distribute(ordered, p.offer);
  const ns = MASTERS.sizes.length;
  const colors = MASTERS.colors.filter((_, c) => offered.slice(c * ns, c * ns + ns).some((q) => q > 0)).map((c) => c.name).join(', ');
  const offeredQty = offered.reduce((a, b) => a + b, 0);
  return {
    qaRequestOrderId: `qo-${tran.toLowerCase()}-${po}-${index}`, orderRefNo: po, styleName: p.style, colorName: colors, orderQty: p.qty, offeredQty,
    actualOfferedQty: completed ? offeredQty : null, acceptedQty: completed ? offeredQty : null, deliveryDate: delivery,
    status: completed ? 'Confirmed' : null, syncState: completed ? 'synced' : 'none', isCompleted: completed, matrix: { ordered, offered },
  };
}

function seedInspection(tran: string, articleCode: string, type: string, date: string, due: string, pos: string[], o: { isNew?: boolean; completed?: boolean; comment?: string } = {}): InspectionRequest {
  const a = MASTERS.articles.find((x) => x.code === articleCode)!;
  return {
    qaRequestId: `qr-${tran.toLowerCase()}`, tranNum: tran, kind: 'inspection', inspectionType: type, articleCode, buyerRef: ` / ${a.trans}`, articleName: a.name.toUpperCase(),
    supplierName: a.supplier.toUpperCase(), imageUrl: null, date, dueDate: due, styleCount: pos.length, isInspectionCancel: false, isExpanderEnable: true, isNew: !!o.isNew,
    comment: o.comment ?? '', attachments: [], orders: pos.map((po, i) => seedOrder(tran, i, po, due, o.completed)), status: o.completed ? 'Completed' : 'Active',
  };
}

function seedSample(tran: string, articleCode: string, sampleType: string, date: string, due: string, s: { lines: number; qty: number; photos: number; swnNo?: string }, o: { isNew?: boolean; completed?: boolean; comment?: string } = {}): InspectionRequest {
  const a = MASTERS.articles.find((x) => x.code === articleCode)!;
  return {
    qaRequestId: `qr-${tran.toLowerCase()}`, tranNum: tran, kind: 'sample', inspectionType: `SAMPLE EVALUATION · ${sampleType.toUpperCase()}`, articleCode, buyerRef: ` / ${s.swnNo ?? a.trans}`,
    articleName: a.name.toUpperCase(), supplierName: a.supplier.toUpperCase(), imageUrl: null, date, dueDate: due, styleCount: 1, isInspectionCancel: false, isExpanderEnable: true, isNew: !!o.isNew,
    comment: o.comment ?? '', attachments: [], orders: [], status: o.completed ? 'Completed' : 'Active',
    sample: { sampleType, lines: s.lines, qty: s.qty, uom: 'PCS', photos: s.photos, swnNo: s.swnNo },
  };
}

/** Requests that look like ones created from the QC Add-Ons screens (NEW badge, due dates, colour x size matrices). */
function addonSeedRequests(): InspectionRequest[] {
  return [
    seedInspection('IR-7310', '79944', 'INLINE FINISHING INSPECTION', '2026-11-19', '2026-11-21', ['396778'], { isNew: true, comment: 'Check hem finish and zip alignment before packing.' }),
    seedInspection('IR-7311', '80211', 'FINAL INSPECTION', '2026-11-18', '2026-11-20', ['396801', '396812'], { isNew: true }),
    seedInspection('IR-7312', '80355', 'PRE-FINAL INSPECTION', '2026-11-17', '2026-11-19', ['396833']),
    seedInspection('IR-7313', '80518', 'INLINE SEWING INSPECTION', '2026-11-16', '2026-11-18', ['396866'], { comment: 'Re-inspection after rework of side seams.' }),
    seedInspection('IR-7314', '79901', 'FINAL INSPECTION', '2026-11-12', '2026-11-14', ['396768'], { completed: true }),
    seedInspection('IR-7315', '80741', 'INLINE FINISHING INSPECTION', '2026-11-10', '2026-11-12', ['396884'], { completed: true }),
    seedSample('SE-7310', '80211', 'Fit Sample', '2026-11-19', '2026-11-23', { lines: 6, qty: 24, photos: 2, swnNo: 'SWN-4244' }, { isNew: true }),
    seedSample('SE-7311', '80355', 'Proto Sample', '2026-11-18', '2026-11-20', { lines: 4, qty: 16, photos: 3, swnNo: 'SWN-4230' }, { isNew: true, comment: 'Buyer wants the cargo pocket 1 cm lower.' }),
    seedSample('SE-7312', '80741', 'Pre Production Sample', '2026-11-16', '2026-11-18', { lines: 3, qty: 12, photos: 1, swnNo: 'SWN-4203' }),
    seedSample('SE-7313', '79901', 'Salesman Sample', '2026-11-05', '2026-11-08', { lines: 5, qty: 20, photos: 4 }, { completed: true }),
  ];
}

export function buildRequests(): InspectionRequest[] {
  const base = {
    inspectionType: 'FINAL INSPECTION',
    articleCode: 'KHW031105-101',
    buyerRef: ' / KHW031105-101',
    articleName: 'W SPRING CLASSICS 26 - SYRIL SPLIT BACK TEE',
    supplierName: 'Topy Top S.A',
    imageUrl: null,
    isExpanderEnable: true,
    comment: '',
  };
  const done = (line: OrderLine): OrderLine => ({ ...line, status: 'Confirmed', syncState: 'synced', isCompleted: true, actualOfferedQty: line.offeredQty, acceptedQty: line.offeredQty });
  return [
    { ...base, qaRequestId: 'qr-7300', tranNum: 'IR-7300', date: '2026-11-02', styleCount: 1, isInspectionCancel: false,
      attachments: PDF_ATTACHMENTS, orders: [orderLine(ORDERS['qo-114081-b'])], status: 'Active' },
    { ...base, qaRequestId: 'qr-7302', tranNum: 'IR-7302', date: '2026-11-13', styleCount: 1, isInspectionCancel: false,
      comment: 'Please verify back neckline opening and zipper function.',
      attachments: [{ id: 'at-0', userFileName: 'sample-500kb.pdf', fileUrl: 'mock://sample' }, ...PDF_ATTACHMENTS],
      orders: [orderLine(ORDERS['qo-114081-a'])], status: 'Active' },
    { ...base, qaRequestId: 'qr-7303', tranNum: 'IR-7303', date: '2026-11-14', styleCount: 2, isInspectionCancel: true,
      attachments: PDF_ATTACHMENTS, orders: [orderLine(ORDERS['qo-114083']), orderLine(ORDERS['qo-114084'])], status: 'Active' },
    { ...base, qaRequestId: 'qr-7299', tranNum: 'IR-7299', date: '2026-10-30', styleCount: 1, isInspectionCancel: false,
      articleCode: 'MCP020226-310', buyerRef: ' / MCP020226-310', articleName: 'M CORE POLO 26 - NAVY', attachments: [],
      orders: [done(orderLine(ORDERS['qo-113950']))], status: 'Completed' },
    ...addonSeedRequests(),
  ];
}

/* ---------------------------------------------------------------- forms */

const CP_JUDGEMENTS: Judgement[] = [
  { id: 'j-confirmed', name: 'Confirmed' },
  { id: 'j-notconfirmed', name: 'No Confirmed' }, // label as in the source app (docs Q-21)
];
const RESULT_JUDGEMENTS: Judgement[] = [
  { id: 'r-approved', name: 'Approved' },
  { id: 'r-rejected', name: 'Rejected' },
];

const POM_BASE: { code: string; name: string; req: number; tol: string; grade: number; critical?: boolean }[] = [
  { code: 'POM/1572', name: 'FRONT BODY LENGTH FROM HPS TO BOTTOM EDGE', req: 22.5, tol: '1/4', grade: 1 },
  { code: 'POM/1705', name: 'CB LENGTH FROM CBN SEAM TO BOTTOM EDGE', req: 20.5, tol: '1/4', grade: 1 },
  { code: 'POM/90', name: 'SHOULDER SEAM FORWARD', req: 0.5, tol: '1/8', grade: 0 },
  { code: 'POM/91', name: 'SHOULDER SLOPE', req: 2, tol: '1/8', grade: 0 },
  { code: 'POM/396', name: 'ACROSS SHOULDER SEAM TO SEAM', req: 18, tol: '3/8', grade: 0.5 },
  { code: 'POM/1698', name: 'ACROSS FRONT 6\\\" FROM HPS', req: 16.25, tol: '3/8', grade: 0.5 },
  { code: 'POM/211', name: 'ACROSS BACK 6\\\" BELOW HPS', req: 17, tol: '3/8', grade: 0.5 },
  { code: 'POM/45', name: 'CHEST 1" BELOW ARMHOLE', req: 19, tol: '3/8', grade: 1, critical: true },
  { code: 'POM/600', name: 'SLEEVE LENGTH FROM SHOULDER POINT', req: 7.5, tol: '1/4', grade: 0.25 },
];

function measurementSize(size: string, idx: number, color: string): MeasurementSize {
  const poms: MeasurementPom[] = POM_BASE.map((p) => ({
    code: p.code,
    name: p.name,
    required: formatFraction(p.req + p.grade * idx),
    tolPositive: p.tol,
    tolNegative: p.tol,
    critical: !!p.critical,
    actuals: [''],
  }));
  return { sizeCode: size, samples: [{ color }], poms };
}

const DEFECT_NAMES: [string, string[]][] = [
  ['APPEARANCE', ['NECKLINE OPENINGS', 'ASYMMETRICAL CUFF', 'ASYMMETRICAL LEGS', 'ASYMMETRICAL POCKET', 'ASYMMETRICAL VENTS',
    'SPOTS', 'SEAM OVER PRESSED', 'WRINKLE MARKS', 'UNEVEN SHADING', 'SHAPE DISTORTION']],
  ['WORKMANSHIP', ['SKIPPED STITCHES', 'OPEN SEAMS', 'BROKEN STITCHES', 'BROKEN NEEDLE']],
];

function checkpoints(prefix: string, names: string[]): EvalCheckPoint[] {
  return names.map((n, i) => ({
    id: uid(prefix, i), name: n, subName: '', judgementId: null, actualValue: '', actualReadonly: false, comments: '',
  }));
}

function area(id: string, name: string, cps: string[], opts: Partial<EvalArea> = {}): EvalArea {
  return {
    id, name, checkPointEnabled: cps.length > 0, showSubCheckPoint: false, showActualValue: false,
    checkPoints: checkpoints(id, cps), judgementEnabled: false, judgementId: null,
    commentEnabled: false, comments: '', attachmentsEnabled: false, attachments: [], ...opts,
  };
}

function evaluation(): EvalGroup[] {
  const common = { checkPointJudgements: CP_JUDGEMENTS, resultJudgements: RESULT_JUDGEMENTS, judgementEnabled: true };
  return [
    { id: 'eg-measurement', name: 'Measurement Results', ...common, judgementId: 'r-approved',
      areas: [area('ea-measurement', 'Measurement', [], { commentEnabled: true })] },
    { id: 'eg-quality', name: 'Quality Results', ...common, judgementId: null,
      areas: [area('ea-quality', 'Quality Checklist',
        ['Zipper', 'Snaps', 'Slider', 'Size label', 'Main label', 'Hanger loop', 'Eyelets', 'Extra button/Botón extra', 'Drawcord', 'Care Label', 'Buttons'],
        { attachmentsEnabled: true })] },
    { id: 'eg-packing', name: 'Packing Results', ...common, judgementId: null,
      areas: [
        area('ea-folding', 'Folding', ['Tissue Paper/Papel Tissue', 'Correct Folding', 'Carton']),
        area('ea-trims', 'Trims', ['Swiftack', 'Price', 'Main Hangtag/Etiqueta Principal', 'Barcode']),
        area('ea-cartons', 'Cartons', ['Tape', 'Straps', 'Sticker', 'Short Side Marking', 'Long Side Marking',
          'Include PL in the carton', 'Check all Carton Number', 'Barcode'], { attachmentsEnabled: true }),
      ] },
  ];
}

/** Rows / sizes / colours of an order – from the fixture spec, or from the colour x size matrix of an Add-Ons order. */
function orderShape(orderId: string, order: InspectionRequest['orders'][number]) {
  const spec = ORDERS[orderId];
  if (spec) {
    const sizes = SIZES.filter((s) => s in spec.qty);
    const rows: SummaryRow[] = sizes.map((s) => ({
      id: uid(`cs-${orderId}`, s), colorName: spec.colorName, colorCode: spec.colorCode, sizeCode: s,
      ordered: spec.qty[s], offered: spec.qty[s], inspected: 0,
    }));
    return { rows, sizes, colors: [spec.colorName], captures: spec.captures, gradeIndex: (s: string) => SIZES.indexOf(s), fromMaster: false };
  }
  // order created through QC Add-Ons: derive everything from its matrix
  const m = order.matrix!;
  const ns = MASTERS.sizes.length;
  const rows: SummaryRow[] = [];
  m.ordered.forEach((ord, i) => {
    const off = m.offered[i] ?? 0;
    if (!ord && !off) return;
    const c = MASTERS.colors[Math.floor(i / ns)];
    rows.push({ id: uid(`cs-${orderId}`, i), colorName: c.name.toUpperCase(), colorCode: c.id, sizeCode: MASTERS.sizes[i % ns], ordered: ord, offered: off, inspected: 0 });
  });
  const sizes = MASTERS.sizes.filter((s) => rows.some((r) => r.sizeCode === s && (r.offered ?? 0) > 0));
  const colors = [...new Set(rows.filter((r) => (r.offered ?? 0) > 0).map((r) => r.colorName))];
  return { rows: rows.filter((r) => (r.offered ?? 0) > 0), sizes, colors, captures: false, gradeIndex: (s: string) => sizes.indexOf(s), fromMaster: true };
}

function defectGroups(fromMaster: boolean): DefectGroup[] {
  const mk = (g: number, name: string, e: { name: string; isDefault: boolean; critical: boolean }): DefectItem => ({
    id: uid(`df${g}`, name), name: name.toUpperCase(), critical: e.critical, comments: '', major: 0, minor: 0, micro: 0, photos: [],
    fromMaster: true, isDefault: e.isDefault, selected: false,
  });
  const groups: DefectGroup[] = [];
  if (fromMaster) {
    // QC Defects master (Group / Name / Default / Critical): defaults are shown, the rest via "Select Defects"
    MASTERS.defectGroups.forEach((g, gi) => {
      const master = MASTERS.defectMaster[g];
      groups.push({ name: g.toUpperCase(), master: master.map((e) => ({ ...e, name: e.name.toUpperCase() })), items: master.filter((e) => e.isDefault).map((e) => mk(gi, e.name, e)) });
    });
  } else {
    DEFECT_NAMES.forEach(([g, names], gi) => {
      // fixture orders: the 7 defects shown in the original screenshot are Default; the others can be selected
      const entries = names.map((n, i) => ({ name: n, isDefault: g === 'APPEARANCE' ? i < 7 : true, critical: n === 'BROKEN NEEDLE' }));
      groups.push({ name: g, master: entries, items: entries.filter((e) => e.isDefault).map((e) => mk(gi, e.name, e)) });
    });
  }
  groups.push({ name: 'OTHER DEFECTS', items: [] }); // free-text group, as at the end of the original screen
  return groups;
}

export function buildForm(request: InspectionRequest, orderId: string): InspectionForm {
  const order = request.orders.find((o) => o.qaRequestOrderId === orderId)!;
  const shape = orderShape(orderId, order);
  const { rows, sizes } = shape;
  const spec = { captures: shape.captures };

  const ra: RaRow[] = ['Route', 'Cutting', 'Sewing', 'Print', 'Embroidery', 'Laundry/Dye', 'FInishing', 'Fabric'].map((a, i) => ({
    id: uid('ra', i), activity: a,
    risk: a === 'Sewing' ? 'PIEZA ESPALDA-ESCOTE ESPALDA' : '',
    actionRequired: a === 'Sewing' ? '-LA PIEZA ESPALDA IZQUIERDA DEBE COINCIDIR CON LA DERECHA EN EL ESCOTE.' : '.',
    comments: '', attachments: [],
  }));

  const qtyRows = (withDefect: string[] | null): FinalQtyRow[] => {
    const list: FinalQtyRow[] = [];
    for (const d of withDefect ?? ['']) {
      for (const r of rows) list.push({ id: `${r.id}|${d}`, colorName: r.colorName, sizeCode: r.sizeCode, defectName: d, qty: null });
    }
    return list;
  };

  const evalGroups = evaluation();
  const sections: InspectionSection[] = [
    { key: 'summary', label: 'Summary Page', kind: 'summary' },
    { key: 'ra-sheet', label: 'RA Sheet', kind: 'ra' },
    { key: 'measurements', label: 'Measurement Evaluation', kind: 'measurement' },
    { key: 'measurement-results', label: 'Measurement Results', kind: 'evaluation', groupId: 'eg-measurement' },
    { key: 'defects', label: 'Defect Capturing', kind: 'defects' },
    { key: 'quality-results', label: 'Quality Results', kind: 'evaluation', groupId: 'eg-quality' },
    { key: 'packing-results', label: 'Packing Results', kind: 'evaluation', groupId: 'eg-packing' },
    { key: 'final', label: 'Final Result', kind: 'final' },
  ];

  return {
    requestId: request.qaRequestId,
    orderId,
    tranNum: request.tranNum,
    orderRefNo: order.orderRefNo,
    inspectionType: request.inspectionType,
    articleName: request.articleName,
    supplierName: request.supplierName,
    sections,
    summary: {
      standards: ['1.0', '1.5', '2.5', '4.0', '6.5'],
      originalStandard: '1.5',
      reviseStandard: '1.5',
      rows,
      cartonsOffered: '',
      cartonsInspected: '',
      cartonNumbers: [],
    },
    ra,
    measurement: { colors: shape.colors, sizes: sizes.map((s) => measurementSize(s, shape.gradeIndex(s), shape.colors[0])) },
    defects: {
      config: {
        microEnabled: false,
        showAcceptedLimit: true,
        limits: { major: 0, minor: 0, micro: 0, total: 0 },
        substitution: { enabled: false, minorsPerMajor: 3 },
      },
      groups: defectGroups(shape.fromMaster),
    },
    evaluation: evalGroups,
    final: {
      captureAccepted: spec.captures,
      captureSeconds: spec.captures,
      captureScrap: spec.captures,
      accepted: spec.captures ? qtyRows(null) : [],
      seconds: spec.captures ? qtyRows(['Stain', 'Hole']) : [],
      scrap: spec.captures ? qtyRows(['Stain', 'Hole']) : [],
      judgements: RESULT_JUDGEMENTS,
      judgementDate: new Date().toISOString().slice(0, 10),
      judgementId: null,
      remarks: '',
      attachments: [],
      qcSignature: null,
      frSignature: null,
    },
    savedSections: [],
    status: 'draft',
  };
}

export function findOrderRequest(requests: InspectionRequest[], orderId: string): InspectionRequest | undefined {
  return requests.find((r) => r.orders.some((o) => o.qaRequestOrderId === orderId));
}

export { parseFraction };

import { InspectionForm } from '../../domain/models/inspection';
import { defectTotals } from '../../domain/rules/defect.rule';
import { summaryTotals } from '../../domain/rules/summary.rule';

/**
 * Tiny dependency-free PDF writer (text only, Helvetica) used by the mock server to produce a
 * real, viewable report. The real server generates the report (docs Q-12).
 */
export function buildPdf(lines: string[]): Blob {
  const esc = (s: string) => s.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '?');
  const perPage = 46;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (!pages.length) pages.push(['']);

  const objs: string[] = [];
  const add = (s: string) => objs.push(s) && objs.length;
  const catalog = add('');
  const pagesObj = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const kids: number[] = [];
  for (const pg of pages) {
    const body =
      'BT /F1 10 Tf 14 TL 40 800 Td\n' + pg.map((l) => `(${esc(l)}) Tj T*`).join('\n') + '\nET';
    const content = add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Contents ${content} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([out], { type: 'application/pdf' });
}

export function reportLines(form: InspectionForm): string[] {
  const t = summaryTotals(form.summary.rows);
  const all = form.defects.groups.flatMap((g) => g.items);
  const d = defectTotals(all, form.defects.config);
  const name = (list: { id: string; name: string }[], id: string | null) => list.find((j) => j.id === id)?.name ?? '-';
  const L: string[] = [
    'WFX QUALITY CONTROLLER - INSPECTION REPORT',
    '',
    `Request: ${form.tranNum}   Type: ${form.inspectionType}`,
    `Article: ${form.articleName}`,
    `Supplier: ${form.supplierName}   Order: ${form.orderRefNo}`,
    '',
    'SUMMARY',
    `Standard: ${form.summary.reviseStandard ?? form.summary.originalStandard}   Sample size: ${t.sampleSize}   Variance: ${t.variance}`,
    `Offered: ${t.offered}   Inspected: ${t.inspected}`,
    `Cartons offered: ${form.summary.cartonsOffered || '-'}   inspected: ${form.summary.cartonsInspected || '-'}`,
    ...form.summary.rows.map((r) => `  ${r.colorName} ${r.sizeCode}: ordered ${r.ordered}, offered ${r.offered ?? 0}, inspected ${r.inspected ?? 0}`),
    '',
    'DEFECTS',
    `Major ${d.major}   Minor ${d.minor}   Total ${d.total}`,
    ...all.filter((x) => x.major || x.minor || x.micro).map((x) => `  ${x.name}: major ${x.major}, minor ${x.minor}${x.comments ? ' - ' + x.comments : ''}`),
    '',
    'EVALUATION RESULTS',
    ...form.evaluation.map((g) => `  ${g.name}: ${name(g.resultJudgements, g.judgementId)}`),
    '',
    'FINAL RESULT',
    `Judgement: ${name(form.final.judgements, form.final.judgementId)}   Date: ${form.final.judgementDate}`,
    `Remarks: ${form.final.remarks || '-'}`,
    `QC signature: ${form.final.qcSignature ? 'signed' : '-'}   Factory representative: ${form.final.frSignature ? 'signed' : '-'}`,
  ];
  return L;
}

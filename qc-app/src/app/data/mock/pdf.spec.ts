import { describe, expect, it } from 'vitest';
import { buildPdf } from './pdf';

describe('mock pdf writer', () => {
  it('produces a structurally valid PDF (xref offsets point at objects, lengths match)', async () => {
    const lines = Array.from({ length: 60 }, (_, i) => `Line ${i} (with) \\ special é chars`);
    const text = await buildPdf(lines).text();
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);

    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');

    const entries = [...text.slice(startxref).matchAll(/^(\d{10}) \d{5} n $/gm)].map((m) => Number(m[1]));
    expect(entries.length).toBeGreaterThan(3);
    entries.forEach((off, i) => expect(text.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));

    // every stream's /Length equals its real length
    for (const m of text.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) {
      expect(m[2].length).toBe(Number(m[1]));
    }
    // 60 lines at 46 per page -> 2 pages
    expect(/\/Count 2/.test(text)).toBe(true);
  });
});

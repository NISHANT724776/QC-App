import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { Color } from '../domain/models/masters';
import { cellValue } from '../domain/rules/matrix.rule';

export interface CellChange {
  index: number;
  value: number;
}

/**
 * Colour x size quantity grid (as in the Add-Ons prototype: "Color/Size Details" and the sample
 * evaluation "Color × size grid"). Flat values array, index = colour * sizeCount + size.
 * Features: row ticks for bulk fill, arrow-key / Enter movement, paste a block from Excel,
 * row/column/grand totals, cells above their max highlighted, locked cells where max is 0.
 */
@Component({
  selector: 'app-qty-matrix',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" (keydown)="onKey($event)" (paste)="onPaste($event)">
      <table class="mx">
        <caption class="sr-only">{{ caption() }}</caption>
        <thead>
          <tr class="grp">
            <th class="stick" scope="col"></th>
            @if (alphaVisible() > 0) {<th [attr.colspan]="alphaVisible()" scope="colgroup">Alpha sizes</th>}
            @if (numericVisible() > 0) {<th [attr.colspan]="numericVisible()" scope="colgroup">Numeric sizes</th>}
            <th class="tot" scope="col"></th>
          </tr>
          <tr>
            <th class="stick" scope="col">Color @if (rowSelect()) {<small>(tick to bulk-fill)</small>}</th>
            @for (s of visible(); track s) {<th scope="col">{{ sizes()[s] }}</th>}
            <th class="tot" scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          @for (c of colors(); track c.id; let ci = $index) {
            <tr>
              <th class="stick" scope="row">
                @if (rowSelect()) {
                  <input type="checkbox" [checked]="ticked().has(ci)" (change)="tick(ci, $any($event.target).checked)" [attr.aria-label]="'Select ' + c.name" />
                }
                <span class="sw" [style.background]="c.hex"></span>{{ c.name }}<small>{{ c.id }}</small>
              </th>
              @for (s of visible(); track s) {
                @let i = ci * ns() + s;
                @if (isEditable(i)) {
                  <td>
                    <input class="cell" inputmode="numeric" placeholder="·" [class.over]="isOver(i)" [value]="values()[i] || ''"
                      [attr.data-c]="ci" [attr.data-s]="s" [attr.aria-label]="c.name + ' size ' + sizes()[s]"
                      (input)="onInput(i, $any($event.target))" (focus)="$any($event.target).select()" />
                  </td>
                } @else {
                  <td class="ro" [class.dis]="editable()" [style.background]="heatBg(values()[i])">{{ values()[i] ? (values()[i] | number) : '' }}</td>
                }
              }
              <td class="tot">{{ rowTotal(ci) ? (rowTotal(ci) | number) : '–' }}</td>
            </tr>
          }
        </tbody>
        <tfoot>
          <tr>
            <th class="stick" scope="row">Total</th>
            @for (s of visible(); track s) {<td>{{ colTotal(s) ? (colTotal(s) | number) : '–' }}</td>}
            <td class="tot gt">{{ grand() | number }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `,
  styles: `
    .wrap{overflow:auto;max-height:52vh;border:1px solid var(--line);border-radius:8px}
    .mx{border-collapse:separate;border-spacing:0;font-size:13px;min-width:100%}
    .mx th,.mx td{padding:3px 4px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);text-align:center;background:#fff;white-space:nowrap}
    .mx thead th{position:sticky;top:0;background:#eaf6f7;color:#14505a;font-weight:600;z-index:2}
    .mx thead tr:nth-child(2) th{top:28px}
    .stick{position:sticky;left:0;z-index:1;text-align:left!important;min-width:170px;font-weight:500;background:#fff}
    thead .stick{z-index:3;background:#eaf6f7}
    .stick small{display:block;color:var(--muted);font-size:10px;margin-left:30px}
    .sw{display:inline-block;width:12px;height:12px;border-radius:50%;margin:0 6px 0 4px;vertical-align:-1px;border:1px solid #0003}
    .stick input[type=checkbox]{width:18px;height:18px;vertical-align:middle;accent-color:var(--brand-dark)}
    .cell{width:56px;min-height:34px;border:1px solid var(--line-strong);border-radius:4px;text-align:right;padding:0 6px;font-size:13px;background:#fff}
    .cell:focus{outline:2px solid var(--brand);border-color:var(--brand)}
    .cell.over{border-color:var(--danger);background:var(--danger-soft);color:var(--danger)}
    .ro{color:#444;min-width:44px}.ro.dis{background:#f1f3f4!important;color:#b0b7bb}
    .tot{font-weight:700;background:#f4f6f7!important}
    tfoot td,tfoot th{font-weight:700;position:sticky;bottom:0;background:#f4f6f7;z-index:1}
  `,
})
export class QtyMatrix {
  readonly colors = input.required<Color[]>();
  readonly sizes = input.required<string[]>();
  readonly alphaCount = input(10);
  readonly values = input.required<number[]>();
  /** per-cell maximum; a cell whose max is 0 is locked ("cells with no order qty are locked") */
  readonly max = input<number[] | null>(null);
  readonly editable = input(true);
  readonly rowSelect = input(false);
  readonly heat = input(false);
  readonly hideEmpty = input(false);
  readonly caption = input('Colour and size quantities');

  readonly cellChange = output<CellChange>();
  readonly pasted = output<CellChange[]>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly ticked = signal<ReadonlySet<number>>(new Set());
  protected readonly ns = computed(() => this.sizes().length);

  protected readonly visible = computed(() => {
    const ns = this.ns();
    const idx = this.sizes().map((_, s) => s);
    if (!this.hideEmpty()) return idx;
    const ref = this.max() ?? this.values();
    return idx.filter((s) => this.colors().some((_, c) => (ref[c * ns + s] ?? 0) > 0));
  });
  protected readonly alphaVisible = computed(() => this.visible().filter((s) => s < this.alphaCount()).length);
  protected readonly numericVisible = computed(() => this.visible().length - this.alphaVisible());
  protected readonly grand = computed(() => this.values().reduce((a, b) => a + b, 0));

  protected rowTotal(c: number): number {
    let t = 0;
    for (let s = 0; s < this.ns(); s++) t += this.values()[c * this.ns() + s] || 0;
    return t;
  }
  protected colTotal(s: number): number {
    let t = 0;
    for (let c = 0; c < this.colors().length; c++) t += this.values()[c * this.ns() + s] || 0;
    return t;
  }

  protected isEditable(i: number): boolean {
    if (!this.editable()) return false;
    const m = this.max();
    return m ? (m[i] ?? 0) > 0 : true;
  }
  protected isOver(i: number): boolean {
    const m = this.max();
    return !!m && (this.values()[i] || 0) > (m[i] ?? 0);
  }
  protected heatBg(v: number): string | null {
    if (!this.heat() || !v) return null;
    const max = Math.max(1, ...this.values());
    return `rgba(13,148,136,${(0.1 + 0.55 * Math.min(1, v / max)).toFixed(2)})`;
  }

  protected tick(c: number, on: boolean): void {
    this.ticked.update((s) => {
      const n = new Set(s);
      if (on) n.add(c);
      else n.delete(c);
      return n;
    });
  }

  /** Colour rows currently ticked (for the "set tick-marked colors to N per size" tool). */
  tickedColors(): number[] {
    return [...this.ticked()];
  }

  protected onInput(i: number, el: HTMLInputElement): void {
    const clean = el.value.replace(/[^0-9]/g, '');
    if (clean !== el.value) el.value = clean;
    this.cellChange.emit({ index: i, value: cellValue(clean) });
  }

  protected onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLInputElement;
    if (!t?.classList?.contains('cell') || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) return;
    const vis = this.visible();
    let c = Number(t.dataset['c']);
    let si = vis.indexOf(Number(t.dataset['s']));
    const dc = e.key === 'ArrowDown' || e.key === 'Enter' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    const ds = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    for (let n = 0; n < this.colors().length + vis.length; n++) {
      c += dc;
      si += ds;
      if (c < 0 || c >= this.colors().length || si < 0 || si >= vis.length) return;
      const next = this.host.nativeElement.querySelector<HTMLInputElement>(`input.cell[data-c="${c}"][data-s="${vis[si]}"]`);
      if (next) {
        e.preventDefault();
        next.focus();
        return;
      }
    }
  }

  protected onPaste(e: ClipboardEvent): void {
    const t = e.target as HTMLInputElement;
    if (!t?.classList?.contains('cell')) return;
    const text = e.clipboardData?.getData('text') ?? '';
    if (!/[\t\n]/.test(text)) return;
    e.preventDefault();
    const vis = this.visible();
    const c0 = Number(t.dataset['c']);
    const s0 = vis.indexOf(Number(t.dataset['s']));
    const changes: CellChange[] = [];
    text.replace(/\r/g, '').split('\n').filter((r) => r.length).forEach((row, ri) =>
      row.split('\t').forEach((v, ci) => {
        const c = c0 + ri;
        const s = vis[s0 + ci];
        if (c >= this.colors().length || s === undefined) return;
        const i = c * this.ns() + s;
        if (!this.isEditable(i)) return;
        const m = this.max();
        const q = cellValue(v);
        changes.push({ index: i, value: m ? Math.min(q, m[i]) : q });
      }),
    );
    if (changes.length) this.pasted.emit(changes);
  }
}

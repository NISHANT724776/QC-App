import { ChangeDetectionStrategy, Component, Injectable, computed, inject, signal, viewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { I18n } from '../../core/i18n/i18n';
import { Toast } from '../../core/ui/toast';
import { Article, DraftOrder, InspectionCopySource, MastersData, ProductionOrder, SampleOrderSource, WorknoteSource } from '../../domain/models/masters';
import { cellValue, overOrdered, sumOf } from '../../domain/rules/matrix.rule';
import { QtyMatrix } from '../../shared/qty-matrix';

/* ------------------------------------------------------------------ Article List */
@Component({
  selector: 'app-article-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg-head"><h2>Article List</h2><div class="acts"><button (click)="ref.close()">✕ Close Window</button></div></div>
    <div class="dlg-body">
      <table class="pick-table">
        <thead>
          <tr><th>Article Name</th><th>Code</th><th>Trans No.</th><th>Category</th></tr>
          <tr><th colspan="4"><input class="input" placeholder="Search name or code" [value]="q()" (input)="q.set($any($event.target).value)" aria-label="Search article" /></th></tr>
        </thead>
        <tbody>
          @for (a of rows(); track a.code) {
            <tr class="sel" tabindex="0" (click)="ref.close(a)" (keydown.enter)="ref.close(a)">
              <td>{{ a.name }}</td><td>{{ a.code }}</td><td>{{ a.trans }}</td><td>{{ a.category }}</td>
            </tr>
          } @empty {
            <tr><td colspan="4" class="empty">No article matches.</td></tr>
          }
        </tbody>
      </table>
    </div>
    <div class="dlg-hint">Tap a row to select the article. Buyer, supplier and category fill in automatically. · View 1-{{ rows().length }} of {{ rows().length }}</div>
  `,
})
export class ArticleDialog {
  protected readonly data = inject<{ articles: Article[] }>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<ArticleDialog, Article>>(MatDialogRef);
  protected readonly q = signal('');
  protected readonly rows = computed(() => {
    const q = this.q().toLowerCase();
    return this.data.articles.filter((a) => !q || a.name.toLowerCase().includes(q) || a.code.includes(q));
  });
}

/* ------------------------------------------------------------------ Production Order List */
@Component({
  selector: 'app-order-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg-head"><h2>Production Order List</h2>
      <div class="acts"><button (click)="ref.close([...picked()])">⤓ OK</button><button (click)="ref.close()">✕ Close</button></div></div>
    <div class="dlg-body">
      <table class="pick-table">
        <thead>
          <tr><th colspan="10"><input class="input" placeholder="Search order no., article, PO, buyer, department…" [value]="q()" (input)="q.set($any($event.target).value)" aria-label="Search production orders" /></th></tr>
          <tr><th></th><th>Production Order No.</th><th>Article Code</th><th>PO</th><th>Buyer</th><th>Department</th><th>Season</th><th>Supplier</th><th>PO Date</th><th class="num">Total Qty</th></tr>
        </thead>
        <tbody>
          @for (p of rows(); track p.po) {
            @let added = data.added.includes(p.po);
            <tr [class.sel]="!added" [class.picked]="picked().has(p.po)">
              <td><input type="checkbox" [checked]="added || picked().has(p.po)" [disabled]="added" (change)="toggle(p.po, $any($event.target).checked)" [attr.aria-label]="'Select order ' + p.po" /></td>
              <td class="link">{{ p.pro }}</td><td>{{ p.articleCode }}</td><td>{{ p.po }}@if (added) { <i>(added)</i> }</td><td>{{ p.buyer }}</td><td>{{ p.department }}</td><td>{{ p.season }}</td><td>{{ p.supplier }}</td><td>{{ p.date }}</td><td class="num">{{ p.qty.toLocaleString('en-US') }}</td>
            </tr>
          } @empty {
            <tr><td colspan="10" class="empty">{{ data.article ? 'No open production orders for this article.' : 'No production orders match your search.' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
    <div class="dlg-hint">
      @if (data.article) {
        Showing orders for {{ data.article.name }} · {{ data.article.buyer }} · {{ data.article.supplier }}
      } @else {
        Showing all open production orders · {{ rows().length }} of {{ data.orders.length }}
      }
    </div>
  `,
})
export class OrderDialog {
  protected readonly data = inject<{ orders: ProductionOrder[]; added: string[]; article: Article | null }>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<OrderDialog, string[]>>(MatDialogRef);
  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  protected readonly q = signal('');
  protected readonly rows = computed(() => {
    const q = this.q().trim().toLowerCase();
    if (!q) return this.data.orders;
    return this.data.orders.filter((p) => [p.pro, p.articleCode, p.po, p.buyer, p.department, p.season, p.supplier, p.style].some((v) => v.toLowerCase().includes(q)));
  });
  protected toggle(po: string, on: boolean): void {
    this.picked.update((s) => {
      const n = new Set(s);
      if (on) n.add(po);
      else n.delete(po);
      return n;
    });
  }
}

/* ------------------------------------------------------------------ Copy from PWN / Existing Inspection */
@Component({
  selector: 'app-copy-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg-head"><h2>{{ tab() === 'pwn' ? 'Copy from PWN' : 'Copy from Existing Inspection' }}</h2>
      <div class="acts"><button (click)="ok()" [disabled]="!selected()">⤓ OK</button><button (click)="ref.close()">✕ Close</button></div></div>
    <div class="dlg-tabs" role="tablist">
      <button role="tab" [class.on]="tab() === 'pwn'" (click)="setTab('pwn')">Copy from PWN</button>
      <button role="tab" [class.on]="tab() === 'insp'" (click)="setTab('insp')">Copy from Existing Inspection</button>
    </div>
    <div class="dlg-body">
      <table class="pick-table">
        <thead><tr><th></th><th>{{ tab() === 'pwn' ? 'PWN No.' : 'Request #' }}</th><th>Article No.</th><th>Ins Type</th><th>Buyer</th><th>Supplier</th><th>Assigned To</th><th>Order (PO)</th><th>{{ tab() === 'pwn' ? 'Planned date' : 'Request date' }}</th></tr></thead>
        <tbody>
          @for (r of rows(); track r.key) {
            <tr class="sel" [class.picked]="selected()?.key === r.key" (click)="selected.set(r)">
              <td><input type="radio" name="copyrow" [checked]="selected()?.key === r.key" [attr.aria-label]="'Select ' + r.key" /></td>
              <td class="link">{{ r.key }}</td><td>{{ r.articleCode }}</td><td>{{ r.inspectionType }}</td><td>{{ r.buyer }}</td><td>{{ r.supplier }}</td><td>{{ r.assignTo }}</td><td>{{ r.po }}</td><td>{{ r.date }}</td>
            </tr>
          } @empty {
            <tr><td colspan="9" class="empty">Nothing to copy from yet.</td></tr>
          }
        </tbody>
      </table>
    </div>
    <div class="dlg-hint">Selecting a row fills Inspection type, Article, Buyer, Supplier, Assigned to and adds its production order.</div>
  `,
})
export class CopyDialog {
  protected readonly data = inject<{ pwn: InspectionCopySource[]; existing: InspectionCopySource[]; tab: 'pwn' | 'insp' }>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<CopyDialog, InspectionCopySource>>(MatDialogRef);
  protected readonly tab = signal<'pwn' | 'insp'>(this.data.tab);
  protected readonly selected = signal<InspectionCopySource | null>(null);
  protected readonly rows = computed(() => (this.tab() === 'pwn' ? this.data.pwn : this.data.existing));
  protected setTab(t: 'pwn' | 'insp'): void {
    this.tab.set(t);
    this.selected.set(null);
  }
  protected ok(): void {
    const s = this.selected();
    if (s) this.ref.close(s);
  }
}

/* ------------------------------------------------------------------ Copy from Sample Order */
@Component({
  selector: 'app-sample-copy-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg-head"><h2>Copy from Sample Order</h2>
      <div class="acts"><button (click)="ok()" [disabled]="!selected()">⤓ OK</button><button (click)="ref.close()">✕ Close</button></div></div>
    <div class="dlg-body">
      <table class="pick-table">
        <thead><tr><th></th><th>SWN No.</th><th>Article No.</th><th>Buyer</th><th>Supplier</th><th>Sample Type</th><th>Season</th></tr></thead>
        <tbody>
          @for (r of data.rows; track r.swn) {
            <tr class="sel" [class.picked]="selected()?.swn === r.swn" (click)="selected.set(r)">
              <td><input type="radio" name="samplerow" [checked]="selected()?.swn === r.swn" [attr.aria-label]="'Select ' + r.swn" /></td>
              <td class="link">{{ r.swn }}</td><td>{{ r.articleCode }}</td><td>{{ r.buyer }}</td><td>{{ r.supplier }}</td><td>{{ r.sampleType }}</td><td>{{ r.season }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <div class="dlg-hint">Selecting a row copies SWN No., Article No., Buyer, Supplier, Sample Type and Season into the form.</div>
  `,
})
export class SampleCopyDialog {
  protected readonly data = inject<{ rows: SampleOrderSource[] }>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<SampleCopyDialog, SampleOrderSource>>(MatDialogRef);
  protected readonly selected = signal<SampleOrderSource | null>(null);
  protected ok(): void {
    const s = this.selected();
    if (s) this.ref.close(s);
  }
}

/* ------------------------------------------------------------------ Worknotes */
@Component({
  selector: 'app-worknote-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg-head"><h2>Worknotes</h2>
      <div class="acts"><button (click)="ok()" [disabled]="!selected()">⤓ OK</button><button (click)="ref.close()">✕ Close Window</button></div></div>
    <div class="dlg-body">
      <table class="pick-table">
        <thead><tr><th></th><th>SWN No.</th><th>Style</th><th>Buyer</th><th>Buyer Department</th><th>Season</th></tr></thead>
        <tbody>
          @for (r of data.rows; track r.swn) {
            <tr class="sel" [class.picked]="selected()?.swn === r.swn" (click)="selected.set(r)">
              <td><input type="radio" name="worknoterow" [checked]="selected()?.swn === r.swn" [attr.aria-label]="'Select ' + r.swn" /></td>
              <td class="link">{{ r.swn }}</td><td>{{ r.style }}</td><td>{{ r.buyer }}</td><td>{{ r.department }}</td><td>{{ r.season }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class WorknoteDialog {
  protected readonly data = inject<{ rows: WorknoteSource[] }>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<WorknoteDialog, WorknoteSource>>(MatDialogRef);
  protected readonly selected = signal<WorknoteSource | null>(null);
  protected ok(): void {
    const s = this.selected();
    if (s) this.ref.close(s);
  }
}

/* ------------------------------------------------------------------ Offer qty: Color/Size Details */
@Component({
  selector: 'app-offer-dialog',
  imports: [MatDialogModule, QtyMatrix],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg-head"><h2>Color/Size Details — Order {{ data.order.po }}</h2>
      <div class="acts">
        <button (click)="export()">⤴ Export</button>
        <button (click)="ok()" [disabled]="over() > 0">⤓ OK</button>
        <button (click)="ref.close()">✕ Close</button>
      </div></div>
    <p class="note">{{ data.order.style }} · {{ data.masters.colors.length }} colors · {{ data.masters.sizes.length }} sizes · ordered {{ orderedTotal().toLocaleString('en-US') }} pcs</p>
    <div class="tools">
      <div class="seg" role="radiogroup" aria-label="View">
        @for (v of views; track v.id) {<button role="radio" [attr.aria-checked]="view() === v.id" [class.on]="view() === v.id" (click)="view.set(v.id)">{{ v.label }}</button>}
      </div>
      @if (view() === 'offer') {
        <span>Set tick-marked colors to</span>
        <input class="input fill" inputmode="numeric" [value]="fill()" (input)="fill.set($any($event.target).value)" aria-label="Quantity per size" />
        <span>per size</span>
        <button class="btn btn-outline" (click)="apply()">Apply</button>
        <button class="btn btn-outline" (click)="match()">Match ordered</button>
        <button class="btn btn-outline" (click)="clear()">Clear</button>
      }
      <label class="chk"><input type="checkbox" [checked]="hide()" (change)="hide.set($any($event.target).checked)" /> Hide sizes with no order qty</label>
    </div>
    <div class="dlg-body">
      <app-qty-matrix #mx [colors]="data.masters.colors" [sizes]="data.masters.sizes" [alphaCount]="data.masters.alphaSizeCount"
        [values]="shown()" [max]="view() === 'offer' ? data.order.ordered : null" [editable]="view() === 'offer'" [rowSelect]="view() === 'offer'"
        [heat]="view() !== 'offer'" [hideEmpty]="hide()" [caption]="'Offer quantities for order ' + data.order.po"
        (cellChange)="edit($event.index, $event.value)" (pasted)="paste($event)" />
    </div>
    <div class="stat">Offered <b>{{ offeredTotal().toLocaleString('en-US') }}</b> of ordered {{ orderedTotal().toLocaleString('en-US') }} ({{ pct() }}%)
      @if (over() > 0) {<span class="err"> · {{ over() }} cell{{ over() > 1 ? 's' : '' }} above ordered qty</span>}
    </div>
  `,
  styles: `
    .note{margin:0;padding:8px 20px;color:var(--muted);font-size:13px}
    .tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:0 20px 8px;font-size:13px}
    .seg{display:inline-flex;background:#dfe3e5;border-radius:6px;padding:2px;gap:2px}
    .seg button{min-height:34px;padding:0 12px;border:0;border-radius:5px;background:transparent;font:inherit;font-weight:600;color:#5b676d;cursor:pointer}
    .seg button.on{background:var(--brand);color:#fff}
    .fill{width:70px;min-height:36px;text-align:right}
    .tools .btn{min-height:36px;padding:0 12px;font-size:13px}
    .chk{display:inline-flex;gap:6px;align-items:center;margin-left:auto}
    .stat{padding:8px 20px 14px;font-size:13px}.err{color:var(--danger)}
  `,
})
export class OfferDialog {
  protected readonly data = inject<{ order: DraftOrder; masters: MastersData }>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<OfferDialog, number[]>>(MatDialogRef);
  private readonly toast = inject(Toast);
  private readonly mx = viewChild.required<QtyMatrix>('mx');
  protected readonly views = [{ id: 'offer', label: 'Offer qty' }, { id: 'ordered', label: 'Ordered' }, { id: 'balance', label: 'Balance' }] as const;
  protected readonly view = signal<'offer' | 'ordered' | 'balance'>('offer');
  protected readonly hide = signal(false);
  protected readonly fill = signal('10');
  protected readonly tmp = signal<number[]>(this.data.order.offered.slice());

  protected readonly orderedTotal = computed(() => sumOf(this.data.order.ordered));
  protected readonly offeredTotal = computed(() => sumOf(this.tmp()));
  protected readonly over = computed(() => overOrdered(this.tmp(), this.data.order.ordered));
  protected readonly pct = computed(() => (this.orderedTotal() ? ((this.offeredTotal() / this.orderedTotal()) * 100).toFixed(1) : '0'));
  protected readonly shown = computed(() => {
    const v = this.view();
    return v === 'offer' ? this.tmp() : v === 'ordered' ? this.data.order.ordered : this.data.order.ordered.map((o, i) => o - (this.tmp()[i] ?? 0));
  });

  protected edit(i: number, v: number): void {
    this.tmp.update((a) => a.map((x, k) => (k === i ? v : x)));
  }
  protected paste(changes: { index: number; value: number }[]): void {
    this.tmp.update((a) => {
      const n = a.slice();
      for (const c of changes) n[c.index] = c.value;
      return n;
    });
    this.toast.info(`Pasted ${changes.length} cells`);
  }
  protected apply(): void {
    const rows = this.mx().tickedColors();
    if (!rows.length) {
      this.toast.info('Tick one or more colors first');
      return;
    }
    const q = cellValue(this.fill());
    const ns = this.data.masters.sizes.length;
    this.tmp.update((a) => {
      const n = a.slice();
      for (const c of rows) for (let s = 0; s < ns; s++) if ((this.data.order.ordered[c * ns + s] ?? 0) > 0) n[c * ns + s] = Math.min(q, this.data.order.ordered[c * ns + s]);
      return n;
    });
  }
  protected match(): void {
    this.tmp.set(this.data.order.ordered.slice());
  }
  protected clear(): void {
    this.tmp.set(this.tmp().map(() => 0));
  }
  protected async export(): Promise<void> {
    const { colors, sizes } = this.data.masters;
    const ns = sizes.length;
    const rows = [['Color', 'Code', ...sizes, 'Total'].join('\t')];
    colors.forEach((c, ci) => {
      const r = sizes.map((_, s) => this.tmp()[ci * ns + s]);
      rows.push([c.name, c.id, ...r, sumOf(r)].join('\t'));
    });
    try {
      await navigator.clipboard.writeText(rows.join('\n'));
      this.toast.success('Matrix copied as tab-separated text. Paste into Excel.');
    } catch {
      this.toast.error('Copy failed');
    }
  }
  protected ok(): void {
    if (this.over() > 0) {
      this.toast.error('Fix the highlighted cells first. Offer qty cannot exceed ordered qty.');
      return;
    }
    this.ref.close(this.tmp());
  }
}

/** Promise-based API used by the Add-Ons forms. */
@Injectable({ providedIn: 'root' })
export class AddonDialogs {
  private readonly dialog = inject(MatDialog);
  protected readonly t = inject(I18n).t;

  private async open<C, D, R>(comp: new (...a: never[]) => C, data: D, width = '980px'): Promise<R | undefined> {
    const ref = this.dialog.open<C, D, R>(comp as never, { data, width, maxWidth: '96vw', panelClass: 'addon-dialog', autoFocus: false });
    return firstValueFrom(ref.afterClosed());
  }

  pickArticle(articles: Article[]) {
    return this.open<ArticleDialog, { articles: Article[] }, Article>(ArticleDialog, { articles }, '860px');
  }
  pickOrders(orders: ProductionOrder[], added: string[], article: Article | null) {
    return this.open<OrderDialog, { orders: ProductionOrder[]; added: string[]; article: Article | null }, string[]>(OrderDialog, { orders, added, article }, '1040px');
  }
  copyInspection(pwn: InspectionCopySource[], existing: InspectionCopySource[], tab: 'pwn' | 'insp') {
    return this.open<CopyDialog, { pwn: InspectionCopySource[]; existing: InspectionCopySource[]; tab: 'pwn' | 'insp' }, InspectionCopySource>(CopyDialog, { pwn, existing, tab }, '1040px');
  }
  copySample(rows: SampleOrderSource[]) {
    return this.open<SampleCopyDialog, { rows: SampleOrderSource[] }, SampleOrderSource>(SampleCopyDialog, { rows }, '900px');
  }
  pickWorknote(rows: WorknoteSource[]) {
    return this.open<WorknoteDialog, { rows: WorknoteSource[] }, WorknoteSource>(WorknoteDialog, { rows }, '820px');
  }
  editOffer(order: DraftOrder, masters: MastersData) {
    return this.open<OfferDialog, { order: DraftOrder; masters: MastersData }, number[]>(OfferDialog, { order, masters }, '1200px');
  }
}

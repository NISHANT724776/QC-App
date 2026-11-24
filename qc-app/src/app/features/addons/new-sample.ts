import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { I18n } from '../../core/i18n/i18n';
import { FormStore } from '../../core/sync/form-store';
import { MastersStore } from '../../core/sync/masters-store';
import { RequestsStore } from '../../core/sync/requests-store';
import { Toast } from '../../core/ui/toast';
import { InspectionRepository, NewRequestDraft } from '../../data/repositories';
import { PhotoAttachment } from '../../domain/models/inspection';
import { Article, MastersData, WorknoteSource } from '../../domain/models/masters';
import { cellValue, sumOf } from '../../domain/rules/matrix.rule';
import { Confirm } from '../../shared/confirm';
import { toIso } from '../../shared/date-utils';
import { Icon } from '../../shared/icon';
import { PhotoPicker } from '../../shared/photo-picker';
import { QtyMatrix } from '../../shared/qty-matrix';
import { Option, SelectField } from '../../shared/select-field';
import { TopBar } from '../../shared/top-bar';
import { AddonDialogs } from './addon-dialogs';

interface FieldDef {
  key: string;
  label: string;
  kind: 'select' | 'date';
}

const MAX_PHOTOS = 6;

/**
 * New Sample Evaluation (QC Add-Ons, Asmara): create a sample evaluation request. Evaluation details, article
 * details, sample photos, associated worknotes, colour/size quantities (grid or rows), comments, attachments.
 */
@Component({
  selector: 'app-new-sample',
  imports: [ReactiveFormsModule, NgTemplateOutlet, TopBar, SelectField, Icon, QtyMatrix, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-top-bar [title]="t('Addons_NewSample')" [back]="true" (backClick)="home()" />
    <main class="page">
      @if (!masters()) {
        <p class="state" role="status">{{ t('Common_Loading') }}</p>
      } @else {
        <div class="copy">
          <span class="lbl">{{ t('Addons_Prefill') }}</span>
          <button type="button" class="btn btn-outline" (click)="copyFromSample()">⧉ {{ t('Addons_CopySample') }}</button>
        </div>
        @if (copied()) {
          <div class="badge" role="status"><span>{{ copied() }}</span><button type="button" (click)="copied.set('')" aria-label="Dismiss">✕</button></div>
        }
        @if (error()) {
          <div class="error" role="alert">{{ error() }}</div>
        }

        <form [formGroup]="form" novalidate>
          <h2>{{ t('Addons_EvaluationDetails') }}</h2>
          <div class="grid g3">
            @for (f of evalFields; track f.key) { <ng-container *ngTemplateOutlet="fld; context: { f: f }" /> }
          </div>

          <h2>{{ t('Addons_ArticleDetails') }}</h2>
          <div class="grid g3">
            <ng-container *ngTemplateOutlet="fld; context: { f: { key: 'category', label: 'Category', kind: 'select' } }" />
            <div class="fld" id="f-article"><span class="label">{{ t('Addons_ArticleNo') }}</span>
              <button type="button" class="artbtn" [class.ph]="!article()" (click)="pickArticle()" aria-haspopup="dialog">
                <span>{{ article() ? article()!.name + ' (' + article()!.code + ')' : t('Addons_SearchArticle') }}</span><app-icon name="search" /></button></div>
            <div class="fld"><span class="label">{{ t('Addons_Buyer') }}</span>
              <app-select-field [options]="buyerOptions()" [value]="ctl('buyer').value" (valueChange)="ctl('buyer').setValue($any($event))" [title]="t('Addons_Buyer')" [placeholder]="t('Common_Select')" /></div>
            <ng-container *ngTemplateOutlet="fld; context: { f: { key: 'buyerContact', label: 'Buyer contact', kind: 'select' } }" />
            <div class="fld"><span class="label">{{ t('Addons_Supplier') }}</span>
              <app-select-field [options]="supplierOptions()" [value]="ctl('supplier').value" (valueChange)="ctl('supplier').setValue($any($event))" [title]="t('Addons_Supplier')" [placeholder]="t('Common_Select')" /></div>
            <ng-container *ngTemplateOutlet="fld; context: { f: { key: 'supplierContact', label: 'Supplier contact', kind: 'select' } }" />
          </div>

          <div class="sechead"><h2>{{ t('Addons_SamplePhotos') }}</h2><span class="cnt">{{ photos().length ? photos().length + ' ' + t('Addons_PhotosAdded') : '' }}</span></div>
          <div class="photos">
            @for (p of photos(); track p.id) {
              <div class="ph"><img [src]="p.dataUrl" [alt]="p.name" loading="lazy" />
                <button type="button" class="rm" (click)="removePhoto(p.id)" [attr.aria-label]="t('Common_Delete') + ' ' + p.name">−</button></div>
            }
            @if (photos().length < ${MAX_PHOTOS}) {
              <button type="button" class="phadd" (click)="addPhoto()">📷 {{ photos().length ? '＋' : t('Addons_AddSamplePhoto') }}</button>
            }
          </div>

          <h2>{{ t('Addons_AssociatedWorknotes') }}</h2>
          <div class="tablewrap">
            <table class="orders">
              <thead><tr><th>{{ t('Addons_Buyer') }}</th><th>{{ t('Addons_WorknoteType') }}</th><th>{{ t('Addons_WorknoteNo') }}</th><th>{{ t('Addons_Department') }}</th><th>{{ t('Addons_Season') }}</th><th></th></tr></thead>
              <tbody>
                @for (w of worknotes(); track w.swn) {
                  <tr><td>{{ w.buyer }}</td><td>Production Work Note</td><td>{{ w.swn }}</td><td>{{ w.department }}</td><td>{{ w.season }}</td>
                    <td><button type="button" class="x" (click)="removeWorknote(w.swn)" [attr.aria-label]="t('Common_Delete') + ' ' + w.swn">✕</button></td></tr>
                } @empty {
                  <tr><td colspan="6" class="empty">{{ t('Addons_NoWorknotes') }}</td></tr>
                }
              </tbody>
            </table>
            <button type="button" class="addrow" (click)="addWorknote()">+ {{ t('Addons_AddWorknote') }}</button>
          </div>

          <div class="sechead"><h2>{{ t('Addons_ColorQty') }}</h2>
            <div class="modes">
              <label class="uom">UOM
                <select class="input" [value]="uom()" (change)="uom.set($any($event.target).value)" aria-label="UOM">
                  @for (u of masters()!.options['UOM']; track u) {<option [value]="u">{{ u }}</option>}
                </select></label>
              <div class="seg" role="radiogroup" [attr.aria-label]="t('Addons_ColorQty')">
                <button type="button" role="radio" [attr.aria-checked]="mode() === 'matrix'" [class.on]="mode() === 'matrix'" (click)="mode.set('matrix')">{{ t('Addons_GridMode') }}</button>
                <button type="button" role="radio" [attr.aria-checked]="mode() === 'rows'" [class.on]="mode() === 'rows'" (click)="mode.set('rows')">{{ t('Addons_RowsMode') }}</button>
              </div>
            </div>
          </div>

          @if (mode() === 'matrix') {
            <div class="tools">
              <span>Set tick-marked colors to</span>
              <input class="input fill" inputmode="numeric" [value]="fill()" (input)="fill.set($any($event.target).value)" aria-label="Quantity per size" />
              <span>per size</span>
              <button type="button" class="btn btn-outline" (click)="applyFill()">Apply</button>
              <button type="button" class="btn btn-outline" (click)="clearAll()">Clear all</button>
              <span class="hint">Arrow keys move between cells · paste a block from Excel</span>
            </div>
            <app-qty-matrix #mx [colors]="masters()!.colors" [sizes]="masters()!.sizes" [alphaCount]="masters()!.alphaSizeCount" [values]="qty()" [rowSelect]="true"
              [caption]="t('Addons_ColorQty')" (cellChange)="setCell($event.index, $event.value)" (pasted)="paste($event)" />
          } @else {
            <div class="tablewrap">
              <table class="orders">
                <thead><tr><th>Color</th><th>Size</th><th>Qty.</th><th>UOM</th><th>{{ t('Common_Comments') }}</th><th></th></tr></thead>
                <tbody>
                  @for (l of lines(); track l.index) {
                    <tr>
                      <td>{{ masters()!.colors[l.c].name }}</td><td>{{ masters()!.sizes[l.s] }}</td>
                      <td><input class="input q" type="number" min="0" [value]="qty()[l.index]" (change)="setCell(l.index, +$any($event.target).value || 0)" [attr.aria-label]="'Qty ' + masters()!.colors[l.c].name + ' ' + masters()!.sizes[l.s]" /></td>
                      <td>{{ uom() }}</td>
                      <td><input class="input" [value]="comments()[l.index] || ''" [placeholder]="t('Addons_AddComment')" (change)="setLineComment(l.index, $any($event.target).value)" /></td>
                      <td><button type="button" class="x" (click)="setCell(l.index, 0)" [attr.aria-label]="t('Common_Delete')">✕</button></td>
                    </tr>
                  }
                  <tr class="draft">
                    <td><app-select-field [options]="colorOptions()" [value]="draft().c" (valueChange)="patchDraft({ c: $any($event) })" title="Color" placeholder="Select" /></td>
                    <td><app-select-field [options]="sizeOptions()" [value]="draft().s" (valueChange)="patchDraft({ s: $any($event) })" title="Size" placeholder="Select" /></td>
                    <td><input class="input q" type="number" min="0" placeholder="0" [value]="draft().q" (input)="patchDraft({ q: $any($event.target).value })" aria-label="Quantity" /></td>
                    <td>{{ uom() }}</td>
                    <td><input class="input" [placeholder]="t('Addons_AddComment')" [value]="draft().cm" (input)="patchDraft({ cm: $any($event.target).value })" aria-label="Line comment" /></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
              <button type="button" class="addrow" (click)="addRow()">+ {{ t('Addons_AddRow') }}</button>
            </div>
          }
          <p class="stat"><b>{{ lines().length }}</b> color/size line{{ lines().length === 1 ? '' : 's' }} · <b>{{ totalQty() | number }}</b> {{ uom().toLowerCase() }}</p>

          <h2>{{ t('Addons_CommentsAttachments') }}</h2>
          <div class="grid g2">
            <div class="fld"><label class="label" for="cm">{{ t('Common_Comments') }}</label>
              <textarea id="cm" class="textarea" formControlName="comments" [placeholder]="t('Addons_AddComment')"></textarea></div>
            <div class="fld"><span class="label">{{ t('Addons_Attachments') }}</span>
              <label class="drop">📎 {{ t('Addons_AttachFile') }}<input type="file" multiple hidden (change)="attach($any($event.target))" /></label>
              @for (f of files(); track f.name) {
                <div class="file">{{ f.name }}<button type="button" (click)="removeFile(f.name)" [attr.aria-label]="t('Common_Delete') + ' ' + f.name">✕</button></div>
              }
            </div>
          </div>
        </form>
      }
    </main>

    <footer class="bar">
      <button type="button" class="btn btn-outline" (click)="home()">{{ t('Common_Cancel') }}</button>
      <button type="button" class="btn btn-primary" [disabled]="busy() || !masters()" (click)="create()">{{ busy() ? t('Common_Loading') : t('Addons_CreateEvaluation') }}</button>
    </footer>

    <ng-template #fld let-f="f">
      <div class="fld" [id]="'f-' + f.key">
        <span class="label">{{ f.label }}</span>
        @if (f.kind === 'date') {
          <input class="input" type="date" [formControl]="ctl(f.key)" [attr.aria-label]="f.label" />
        } @else {
          <app-select-field [options]="opts(f.label)" [value]="ctl(f.key).value" (valueChange)="ctl(f.key).setValue($any($event))" [title]="f.label" [placeholder]="t('Common_Select')" />
        }
      </div>
    </ng-template>
  `,
  styles: `
    :host{display:flex;flex-direction:column;min-height:100vh;background:var(--surface)}
    .page{flex:1;width:100%;max-width:1180px;margin:0 auto;padding:12px 16px 110px}
    .state{text-align:center;color:var(--muted);padding:40px}
    h2{margin:22px 0 10px;font-size:17px;font-weight:600;color:#444}
    .grid{display:grid;gap:14px 16px;margin-bottom:12px}
    .g3{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.g2{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
    .fld{min-width:0}
    .copy{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:8px 0}.copy .btn{min-height:40px;padding:0 14px;font-size:14px}.lbl{color:var(--muted);font-size:13px}
    .badge{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:8px 0;padding:8px 14px;background:#e6f4ea;color:#17603a;border-radius:6px;font-size:14px}
    .badge button{border:0;background:none;color:inherit;cursor:pointer;font-size:16px;min-width:32px;min-height:32px}
    .error{margin:8px 0;padding:10px 14px;background:var(--danger-soft);color:var(--danger);border-left:4px solid var(--danger);border-radius:4px}
    .artbtn{width:100%;min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px;border:1px solid var(--line-strong);border-radius:6px;background:var(--surface);font:inherit;cursor:pointer;text-align:left}
    .artbtn.ph span{color:var(--muted)}.artbtn:hover{border-color:var(--brand)}
    .sechead{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px}.cnt{font-size:13px;color:var(--muted)}
    .photos{display:flex;flex-wrap:wrap;gap:12px}
    .ph{position:relative;width:96px;height:96px;border:1px solid var(--line);border-radius:8px;display:grid;place-items:center;background:#fff}
    .ph img{max-width:100%;max-height:100%;object-fit:cover;border-radius:6px}
    .rm{position:absolute;top:-8px;right:-8px;width:26px;height:26px;border-radius:50%;border:0;background:var(--danger);color:#fff;cursor:pointer;font-size:16px}
    .phadd{min-width:96px;min-height:96px;padding:0 18px;border:1px dashed var(--line-strong);border-radius:8px;background:#fff;color:var(--muted);font:inherit;cursor:pointer}
    .phadd:hover{border-color:var(--brand);color:var(--brand-dark)}
    .tablewrap{border:1px solid var(--line);border-radius:10px;overflow:auto}
    .orders{width:100%;border-collapse:collapse;font-size:14px;min-width:560px}
    .orders th,.orders td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--line)}
    .orders thead th{background:#f4f6f7;font-weight:600}.empty{text-align:center!important;color:var(--muted)}
    .q{max-width:90px}.x{border:0;background:none;color:var(--danger);cursor:pointer;min-width:36px;min-height:36px;font-size:16px}
    .addrow{width:100%;min-height:44px;border:0;background:#fafbfb;color:var(--brand-dark);font:inherit;font-weight:600;cursor:pointer}
    .modes{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.uom{display:flex;gap:6px;align-items:center;font-size:13px;color:var(--muted)}.uom .input{min-height:36px;width:auto}
    .seg{display:inline-flex;background:#dfe3e5;border-radius:6px;padding:2px;gap:2px}
    .seg button{min-height:34px;padding:0 12px;border:0;border-radius:5px;background:transparent;font:inherit;font-size:13px;font-weight:600;color:#5b676d;cursor:pointer}
    .seg button.on{background:var(--brand);color:#fff}
    .tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:8px 0;font-size:13px}
    .tools .btn{min-height:36px;padding:0 12px;font-size:13px}.fill{width:70px;min-height:36px;text-align:right}.hint{color:var(--muted)}
    .stat{margin:8px 2px;font-size:14px}
    .drop{display:grid;place-items:center;min-height:64px;border:1px dashed var(--line-strong);border-radius:8px;color:var(--muted);cursor:pointer}
    .drop:hover{border-color:var(--brand);color:var(--brand-dark)}
    .file{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;font-size:13px}.file button{border:0;background:none;cursor:pointer;color:var(--danger)}
    .bar{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:flex-end;gap:12px;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid var(--line);z-index:5}
    .bar .btn{min-width:160px}
    @media (max-width:520px){.bar .btn{flex:1;min-width:0}}
  `,
})
export class NewSamplePage implements OnInit {
  private readonly mastersStore = inject(MastersStore);
  private readonly repo = inject(InspectionRepository);
  private readonly requests = inject(RequestsStore);
  private readonly forms = inject(FormStore);
  private readonly dialogs = inject(AddonDialogs);
  private readonly picker = inject(PhotoPicker);
  private readonly confirm = inject(Confirm);
  private readonly toast = inject(Toast);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly t = inject(I18n).t;
  private readonly mx = viewChild<QtyMatrix>('mx');

  protected readonly masters = signal<MastersData | null>(null);
  protected readonly article = signal<Article | null>(null);
  protected readonly swn = signal<string>('');
  protected readonly photos = signal<PhotoAttachment[]>([]);
  protected readonly worknotes = signal<WorknoteSource[]>([]);
  protected readonly files = signal<File[]>([]);
  protected readonly error = signal('');
  protected readonly copied = signal('');
  protected readonly busy = signal(false);

  protected readonly mode = signal<'matrix' | 'rows'>('matrix');
  protected readonly uom = signal('PCS');
  protected readonly qty = signal<number[]>([]);
  protected readonly comments = signal<Record<number, string>>({});
  protected readonly fill = signal('2');
  protected readonly draft = signal<{ c: string | null; s: string | null; q: string; cm: string }>({ c: null, s: null, q: '', cm: '' });

  protected readonly evalFields: FieldDef[] = [
    { key: 'area', label: 'Evaluation area', kind: 'select' },
    { key: 'sampleType', label: 'Sample type', kind: 'select' },
    { key: 'by', label: 'Evaluation by', kind: 'select' },
    { key: 'company', label: 'Evaluation company', kind: 'select' },
    { key: 'assignedTo', label: 'Assigned to', kind: 'select' },
    { key: 'resultBy', label: 'Result required by', kind: 'date' },
  ];
  private readonly defaults = { area: '', sampleType: '', by: 'Internal', company: 'Juritex Import Export', assignedTo: 'Admin Juritex', resultBy: '', category: '', buyer: '', buyerContact: '', supplier: '', supplierContact: '', comments: '' };
  protected readonly form = this.fb.group(this.defaults);

  protected readonly buyerOptions = computed<Option[]>(() => [...new Set((this.masters()?.articles ?? []).map((a) => a.buyer))].map((b) => ({ id: b, label: b })));
  protected readonly supplierOptions = computed<Option[]>(() => [...new Set((this.masters()?.articles ?? []).map((a) => a.supplier))].map((b) => ({ id: b, label: b })));
  protected readonly colorOptions = computed<Option[]>(() => (this.masters()?.colors ?? []).map((c, i) => ({ id: String(i), label: c.name })));
  protected readonly sizeOptions = computed<Option[]>(() => (this.masters()?.sizes ?? []).map((s, i) => ({ id: String(i), label: s })));
  protected readonly totalQty = computed(() => sumOf(this.qty()));
  protected readonly lines = computed(() => {
    const ns = this.masters()?.sizes.length ?? 1;
    return this.qty().map((v, index) => ({ index, v, c: Math.floor(index / ns), s: index % ns })).filter((l) => l.v > 0);
  });

  async ngOnInit(): Promise<void> {
    try {
      const m = await this.mastersStore.ensure();
      this.masters.set(m);
      this.qty.set(new Array(m.colors.length * m.sizes.length).fill(0));
      await this.pickInitialOrder(m);
    } catch {
      this.error.set(this.t('Msg_NoInternetConnection'));
    }
  }

  /** Lets the user jump straight to a production order (searchable, all orders) before filling anything else; prefills category/article/buyer/supplier. */
  private async pickInitialOrder(m: MastersData): Promise<void> {
    const picked = await this.dialogs.pickOrders(m.productionOrders, [], null);
    if (!picked?.length) return;
    const first = m.productionOrders.find((p) => p.po === picked[0]);
    const art = first && m.articles.find((a) => a.code === first.articleCode);
    if (art) this.selectArticle(art);
  }

  protected ctl(key: string): FormControl<string> {
    return (this.form.controls as Record<string, FormControl<string>>)[key];
  }
  protected opts(name: string): Option[] {
    return (this.masters()?.options[name] ?? []).map((o) => ({ id: o, label: o }));
  }
  protected home(): void {
    void this.router.navigate(['/requests']);
  }

  protected async pickArticle(): Promise<void> {
    const a = await this.dialogs.pickArticle(this.masters()!.articles);
    if (a) this.selectArticle(a);
  }
  private selectArticle(a: Article): void {
    this.article.set(a);
    this.form.patchValue({ buyer: a.buyer, supplier: a.supplier, category: a.category });
  }

  protected async copyFromSample(): Promise<void> {
    const m = this.masters()!;
    const src = await this.dialogs.copySample(m.sampleOrders);
    if (!src) return;
    const art = m.articles.find((a) => a.code === src.articleCode);
    if (art) this.selectArticle(art);
    this.swn.set(src.swn);
    this.form.patchValue({ sampleType: src.sampleType });
    // colour/size lines pre-filled from the sample order (3 colours x 5 sizes, as in the prototype)
    const ns = m.sizes.length;
    const q = new Array(m.colors.length * ns).fill(0);
    for (let c = 0; c < 3; c++) for (let s = 1; s <= 5; s++) q[c * ns + s] = 2;
    this.qty.set(q);
    this.copied.set(`✓ ${this.t('Addons_CopiedSample', { src: src.swn })}`);
  }

  protected async addPhoto(): Promise<void> {
    const added = await this.picker.pick();
    if (added.length) this.photos.update((cur) => [...cur, ...added].slice(0, MAX_PHOTOS));
  }
  protected removePhoto(id: string): void {
    this.photos.update((cur) => cur.filter((p) => p.id !== id));
  }

  protected async addWorknote(): Promise<void> {
    const w = await this.dialogs.pickWorknote(this.masters()!.worknotes);
    if (w && !this.worknotes().some((x) => x.swn === w.swn)) this.worknotes.update((cur) => [...cur, w]);
  }
  protected removeWorknote(swn: string): void {
    this.worknotes.update((cur) => cur.filter((w) => w.swn !== swn));
  }

  protected setCell(i: number, v: number): void {
    this.qty.update((a) => a.map((x, k) => (k === i ? Math.max(0, v) : x)));
  }
  protected paste(ch: { index: number; value: number }[]): void {
    this.qty.update((a) => {
      const n = a.slice();
      for (const c of ch) n[c.index] = c.value;
      return n;
    });
    this.toast.info(`Pasted ${ch.length} cells`);
  }
  protected applyFill(): void {
    const rows = this.mx()?.tickedColors() ?? [];
    if (!rows.length) {
      this.toast.info('Tick one or more colors first');
      return;
    }
    const q = cellValue(this.fill());
    const ns = this.masters()!.sizes.length;
    this.qty.update((a) => {
      const n = a.slice();
      for (const c of rows) for (let s = 0; s < ns; s++) n[c * ns + s] = q;
      return n;
    });
  }
  protected clearAll(): void {
    this.qty.update((a) => a.map(() => 0));
  }
  protected setLineComment(i: number, v: string): void {
    this.comments.update((c) => ({ ...c, [i]: v }));
  }
  protected patchDraft(p: Partial<{ c: string | null; s: string | null; q: string; cm: string }>): void {
    this.draft.update((d) => ({ ...d, ...p }));
  }
  protected addRow(): void {
    const d = this.draft();
    if (d.c === null || d.s === null || !(parseInt(d.q, 10) > 0)) {
      this.toast.info('Pick a color, a size and a quantity above 0.');
      return;
    }
    const i = +d.c * this.masters()!.sizes.length + +d.s;
    this.qty.update((a) => a.map((x, k) => (k === i ? x + parseInt(d.q, 10) : x)));
    if (d.cm) this.setLineComment(i, d.cm);
    this.draft.set({ c: null, s: null, q: '', cm: '' });
    this.toast.success('Line added');
  }

  protected attach(el: HTMLInputElement): void {
    const add = Array.from(el.files ?? []);
    this.files.update((cur) => [...cur, ...add.filter((f) => !cur.some((c) => c.name === f.name))]);
    el.value = '';
  }
  protected removeFile(name: string): void {
    this.files.update((cur) => cur.filter((f) => f.name !== name));
  }

  /** Validation messages are the ones shown by the prototype. */
  protected validate(): string {
    if (!this.article()) return this.t('Addons_ErrArticleSample');
    if (!this.ctl('sampleType').value) return this.t('Addons_ErrSampleType');
    return '';
  }

  protected async create(): Promise<void> {
    this.error.set('');
    const err = this.validate();
    if (err) {
      this.error.set(err);
      document.querySelector('.error')?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (!navigator.onLine) {
      this.error.set(this.t('Addons_ErrOffline'));
      return;
    }
    const a = this.article()!;
    const v = this.form.getRawValue();
    const draft: NewRequestDraft = {
      prefix: 'SE', kind: 'sample', inspectionType: `SAMPLE EVALUATION · ${v.sampleType.toUpperCase()}`,
      articleCode: a.code, buyerRef: ` / ${this.swn() || a.trans}`, articleName: a.name.toUpperCase(), supplierName: (v.supplier || a.supplier).toUpperCase(), imageUrl: null,
      date: toIso(new Date()), dueDate: v.resultBy || undefined, styleCount: 1, isInspectionCancel: false, isExpanderEnable: true, isNew: true, comment: v.comments,
      attachments: this.files().map((f, i) => ({ id: `up-${i}-${f.name}`, userFileName: f.name, fileUrl: `mock://upload/${f.name}` })),
      orders: [],
      sample: { sampleType: v.sampleType, lines: this.lines().length, qty: this.totalQty(), uom: this.uom(), photos: this.photos().length, swnNo: this.swn() || undefined },
    };
    this.busy.set(true);
    try {
      const created = await this.repo.createRequest(draft);
      await this.requests.add(created);
      await this.confirm.ask(
        this.t('Addons_EvaluationCreatedBody', { name: a.name, n: created.sample?.lines ?? 0 }),
        { title: this.t('Addons_EvaluationCreated', { id: created.tranNum }), confirmLabel: this.t('Addons_ViewActive'), hideCancel: true },
      );
      this.reset();
      await this.router.navigate(['/requests'], { queryParams: { tab: 'active', kind: 'sample' } });
    } catch {
      this.error.set(this.t('Msg_NoInternetConnection'));
    } finally {
      this.busy.set(false);
    }
  }

  private reset(): void {
    this.form.reset(this.defaults);
    this.article.set(null);
    this.swn.set('');
    this.photos.set([]);
    this.worknotes.set([]);
    this.files.set([]);
    this.copied.set('');
    this.comments.set({});
    this.draft.set({ c: null, s: null, q: '', cm: '' });
    this.qty.set(this.qty().map(() => 0));
  }
}

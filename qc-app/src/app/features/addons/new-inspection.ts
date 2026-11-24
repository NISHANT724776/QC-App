import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { I18n } from '../../core/i18n/i18n';
import { FormStore } from '../../core/sync/form-store';
import { MastersStore } from '../../core/sync/masters-store';
import { RequestsStore } from '../../core/sync/requests-store';
import { Toast } from '../../core/ui/toast';
import { InspectionRepository, NewRequestDraft } from '../../data/repositories';
import { Article, DraftOrder, InspectionCopySource, MastersData, ProductionOrder } from '../../domain/models/masters';
import { InspectionRequest, OrderLine } from '../../domain/models/request';
import { distribute, generateOrdered, sumOf } from '../../domain/rules/matrix.rule';
import { Confirm } from '../../shared/confirm';
import { toIso } from '../../shared/date-utils';
import { Icon } from '../../shared/icon';
import { Option, SelectField } from '../../shared/select-field';
import { TopBar } from '../../shared/top-bar';
import { AddonDialogs } from './addon-dialogs';

const COLOR_W = [3.2, 2.6, 2.2, 1.2, 1.0, 1.6, 0.9, 0.7, 0.8, 1.1];
const SIZE_W = [0.3, 0.8, 1.6, 2.2, 2.0, 1.4, 0.9, 0.4, 0.2, 0.1, 0.2, 0.5, 0.9, 1.3, 1.5, 1.4, 1.1, 0.8, 0.5, 0.35, 0.2, 0.12, 0.08, 0.05, 0.03];

interface FieldDef {
  key: string;
  label: string;
  kind: 'select' | 'date';
  /** key in masters.options (defaults to the label) */
  options?: string;
}

/**
 * New Inspection (QC Add-Ons, Asmara): create an inspection request from the app so the inspector can enter the
 * result right away. Fields, validations and dialogs follow the requirements document and the supplied prototype.
 */
@Component({
  selector: 'app-new-inspection',
  imports: [ReactiveFormsModule, NgTemplateOutlet, TopBar, SelectField, Icon, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-top-bar [title]="t('Addons_NewInspection')" [back]="true" (backClick)="home()" />
    <main class="page">
      @if (!masters()) {
        <p class="state" role="status">{{ t('Common_Loading') }}</p>
      } @else {
        <div class="copy">
          <span class="lbl">{{ t('Addons_Prefill') }}</span>
          <button type="button" class="btn btn-outline" (click)="copyFrom('pwn')">⧉ {{ t('Addons_CopyPwn') }}</button>
          <button type="button" class="btn btn-outline" (click)="copyFrom('insp')">⧉ {{ t('Addons_CopyInspection') }}</button>
        </div>
        @if (copied()) {
          <div class="badge" role="status"><span>{{ copied() }}</span><button type="button" (click)="copied.set('')" aria-label="Dismiss">✕</button></div>
        }
        @if (error()) {
          <div class="error" role="alert">{{ error() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="create()" novalidate>
          <h2>{{ t('Addons_InspectionDetails') }}</h2>
          <div class="grid g3">
            @for (f of detailFields; track f.key) { <ng-container *ngTemplateOutlet="fld; context: { f: f }" /> }
          </div>

          <h2>{{ t('Addons_ArticleDetails') }}</h2>
          <div class="grid g3">
            <div class="fld"><span class="label">{{ t('Addons_Category') }}</span>
              <app-select-field [options]="opts('Category')" [value]="form.controls['category'].value" (valueChange)="form.controls['category'].setValue($any($event))" [title]="t('Addons_Category')" [placeholder]="t('Common_Select')" /></div>
            <div class="fld" id="f-article"><span class="label">{{ t('Addons_ArticleNo') }}</span>
              <button type="button" class="artbtn" [class.ph]="!article()" (click)="pickArticle()" aria-haspopup="dialog">
                <span>{{ article() ? article()!.name + ' (' + article()!.code + ')' : t('Addons_SearchArticle') }}</span><app-icon name="search" /></button></div>
            <div class="fld"><span class="label">{{ t('Addons_Buyer') }}</span>
              <app-select-field [options]="buyerOptions()" [value]="form.controls['buyer'].value" (valueChange)="form.controls['buyer'].setValue($any($event))" [title]="t('Addons_Buyer')" [placeholder]="t('Common_Select')" /></div>
          </div>
          <div class="grid g2">
            <div class="fld"><span class="label">{{ t('Addons_Supplier') }}</span>
              <app-select-field [options]="supplierOptions()" [value]="form.controls['supplier'].value" (valueChange)="form.controls['supplier'].setValue($any($event))" [title]="t('Addons_Supplier')" [placeholder]="t('Common_Select')" /></div>
            <div class="fld"><span class="label">{{ t('Addons_Factory') }}</span>
              <app-select-field [options]="opts('Factory')" [value]="form.controls['factory'].value" (valueChange)="form.controls['factory'].setValue($any($event))" [title]="t('Addons_Factory')" [placeholder]="t('Common_Select')" /></div>
          </div>

          <h2>{{ t('Addons_AssociatedOrders') }}</h2>
          <div class="tablewrap">
            <table class="orders">
              <thead><tr><th>{{ t('Request_OrderNo') }}</th><th>{{ t('Request_StyleName') }}</th><th class="n">{{ t('Request_OrderQty') }}</th><th class="n">{{ t('Request_OfferQty') }}</th><th></th></tr></thead>
              <tbody>
                @for (o of orders(); track o.po; let i = $index) {
                  <tr>
                    <td class="olink">{{ o.po }}</td><td>{{ o.style }}</td><td class="n">{{ o.orderQty | number }}</td>
                    <td class="n"><button type="button" class="offer" (click)="editOffer(i)" [title]="t('Addons_EditOffer')">{{ total(o.offered) | number }} ▦</button></td>
                    <td><button type="button" class="x" (click)="removeOrder(i)" [attr.aria-label]="t('Addons_RemoveOrder') + ' ' + o.po">✕</button></td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="empty">{{ t('Addons_NoOrders') }}</td></tr>
                }
              </tbody>
            </table>
            <button type="button" class="addrow" [class.disabled]="!article()" [attr.aria-disabled]="!article()" (click)="addOrder()">+ {{ t('Addons_AddOrder') }}</button>
          </div>
          <p class="note" [class.ok]="!!article()">{{ article() ? '✓ ' + t('Addons_OrdersFiltered') : '🔒 ' + t('Addons_SelectArticleFirst') }}</p>

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
      <button type="button" class="btn btn-outline" (click)="cancel()">{{ t('Common_Cancel') }}</button>
      <button type="button" class="btn btn-primary" [disabled]="busy() || !masters()" (click)="create()">{{ busy() ? t('Common_Loading') : t('Addons_CreateInspection') }}</button>
    </footer>

    <ng-template #fld let-f="f">
      <div class="fld" [id]="'f-' + f.key">
        <span class="label">{{ f.label }}</span>
        @if (f.kind === 'date') {
          <input class="input" type="date" [formControl]="ctl(f.key)" [attr.aria-label]="f.label" />
        } @else {
          <app-select-field [options]="opts(f.options ?? f.label)" [value]="ctl(f.key).value" (valueChange)="ctl(f.key).setValue($any($event))" [title]="f.label" [placeholder]="t('Common_Select')" />
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
    .g3{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
    .g2{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
    .fld{min-width:0}
    .copy{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:8px 0}
    .copy .btn{min-height:40px;padding:0 14px;font-size:14px}.lbl{color:var(--muted);font-size:13px}
    .badge{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:8px 0;padding:8px 14px;background:#e6f4ea;color:#17603a;border-radius:6px;font-size:14px}
    .badge button{border:0;background:none;color:inherit;cursor:pointer;font-size:16px;min-width:32px;min-height:32px}
    .error{margin:8px 0;padding:10px 14px;background:var(--danger-soft);color:var(--danger);border-left:4px solid var(--danger);border-radius:4px}
    .artbtn{width:100%;min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px;border:1px solid var(--line-strong);border-radius:6px;background:var(--surface);font:inherit;cursor:pointer;text-align:left}
    .artbtn.ph span{color:var(--muted)}.artbtn:hover{border-color:var(--brand)}
    .tablewrap{border:1px solid var(--line);border-radius:10px;overflow:hidden}
    .orders{width:100%;border-collapse:collapse;font-size:14px}
    .orders th,.orders td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--line)}
    .orders thead th{background:#f4f6f7;font-weight:600}.n{text-align:right!important}
    .olink{color:var(--brand-dark)}.empty{text-align:center!important;color:var(--muted)}
    .offer{border:0;background:none;color:var(--brand-dark);font:inherit;cursor:pointer;text-decoration:underline;min-height:36px}
    .x{border:0;background:none;color:var(--danger);cursor:pointer;min-width:36px;min-height:36px;font-size:16px}
    .addrow{width:100%;min-height:44px;border:0;background:#fafbfb;color:var(--brand-dark);font:inherit;font-weight:600;cursor:pointer}
    .addrow.disabled{color:#a9b2b7;cursor:not-allowed}
    .note{margin:6px 2px 0;font-size:13px;color:var(--muted)}.note.ok{color:var(--ok)}
    .drop{display:grid;place-items:center;min-height:64px;border:1px dashed var(--line-strong);border-radius:8px;color:var(--muted);cursor:pointer}
    .drop:hover{border-color:var(--brand);color:var(--brand-dark)}
    .file{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;font-size:13px}
    .file button{border:0;background:none;cursor:pointer;color:var(--danger)}
    .bar{position:fixed;left:0;right:0;bottom:0;display:flex;justify-content:flex-end;gap:12px;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid var(--line);z-index:5}
    .bar .btn{min-width:160px}
    @media (max-width:520px){.bar .btn{flex:1;min-width:0}}
  `,
})
export class NewInspectionPage implements OnInit {
  private readonly mastersStore = inject(MastersStore);
  private readonly repo = inject(InspectionRepository);
  private readonly requests = inject(RequestsStore);
  private readonly forms = inject(FormStore);
  private readonly dialogs = inject(AddonDialogs);
  private readonly confirm = inject(Confirm);
  private readonly toast = inject(Toast);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly t = inject(I18n).t;

  protected readonly masters = signal<MastersData | null>(null);
  protected readonly article = signal<Article | null>(null);
  protected readonly orders = signal<DraftOrder[]>([]);
  protected readonly files = signal<File[]>([]);
  protected readonly error = signal('');
  protected readonly copied = signal('');
  protected readonly busy = signal(false);

  protected readonly detailFields: FieldDef[] = [
    { key: 'area', label: 'Inspection area', kind: 'select' },
    { key: 'type', label: 'Inspection type', kind: 'select' },
    { key: 'by', label: 'Inspection by', kind: 'select' },
    { key: 'company', label: 'Inspection company', kind: 'select' },
    { key: 'qcManager', label: 'QC manager', kind: 'select' },
    { key: 'assignTo', label: 'Assign to', kind: 'select' },
    { key: 'targetDate', label: 'Target date', kind: 'date' },
    { key: 'scheduleDate', label: 'Schedule date', kind: 'date' },
    { key: 'standardType', label: 'Standard type', kind: 'select' },
    { key: 'standard', label: 'Inspection standard', kind: 'select' },
  ];

  private readonly defaults = { area: 'Production', type: 'Inline finishing', by: 'Internal', company: 'Indochine International', qcManager: '', assignTo: '', targetDate: '', scheduleDate: '', standardType: 'Standard AQL', standard: '2.5', category: '', buyer: '', supplier: '', factory: '', comments: '' };
  protected readonly form = this.fb.group(this.defaults);

  protected readonly buyerOptions = computed<Option[]>(() => [...new Set((this.masters()?.articles ?? []).map((a) => a.buyer))].map((b) => ({ id: b, label: b })));
  protected readonly supplierOptions = computed<Option[]>(() => [...new Set((this.masters()?.articles ?? []).map((a) => a.supplier))].map((b) => ({ id: b, label: b })));

  async ngOnInit(): Promise<void> {
    try {
      const m = await this.mastersStore.ensure();
      this.masters.set(m);
      await this.pickInitialOrder(m);
    } catch {
      this.error.set(this.t('Msg_NoInternetConnection'));
    }
  }

  /** Lets the user jump straight to a production order (searchable, all orders) before filling anything else; prefills article/category/buyer/supplier and the associated order. */
  private async pickInitialOrder(m: MastersData): Promise<void> {
    const picked = await this.dialogs.pickOrders(m.productionOrders, [], null);
    if (!picked?.length) return;
    const chosen = picked.map((po) => m.productionOrders.find((p) => p.po === po)!).filter(Boolean);
    if (!chosen.length) return;
    const art = m.articles.find((a) => a.code === chosen[0].articleCode);
    if (art) this.selectArticle(art);
    this.orders.set(chosen.map((p) => this.mkOrder(p)));
  }

  protected ctl(key: string): FormControl<string> {
    return (this.form.controls as Record<string, FormControl<string>>)[key];
  }

  protected opts(name: string): Option[] {
    return (this.masters()?.options[name] ?? []).map((o) => ({ id: o, label: o }));
  }
  protected total = sumOf;

  protected home(): void {
    void this.router.navigate(['/requests']);
  }
  protected cancel(): void {
    this.home();
  }

  protected async pickArticle(): Promise<void> {
    const a = await this.dialogsPickArticle();
    if (a) this.selectArticle(a);
  }
  private dialogsPickArticle() {
    return this.dialogs.pickArticle(this.masters()!.articles);
  }

  private selectArticle(a: Article): void {
    if (this.article() && this.article()!.code !== a.code && this.orders().length) {
      this.orders.set([]);
      this.toast.info(this.t('Addons_OrdersCleared'));
    }
    this.article.set(a);
    this.form.patchValue({ buyer: a.buyer, supplier: a.supplier, category: a.category });
  }

  /** Orders are loaded from the Production Order List, filtered by the selected article. */
  protected async addOrder(): Promise<void> {
    const a = this.article();
    if (!a) {
      this.toast.info(this.t('Addons_SelectArticleFirst'));
      return;
    }
    const list = this.masters()!.productionOrders.filter((p) => p.articleCode === a.code);
    const picked = await this.dialogs.pickOrders(list, this.orders().map((o) => o.po), a);
    if (!picked?.length) return;
    this.orders.update((cur) => [...cur, ...picked.map((po) => this.mkOrder(list.find((p) => p.po === po)!))]);
    this.toast.success(this.t('Addons_OrdersAdded', { n: picked.length }));
  }

  /** Mock ordered matrix for a production order; offered defaults to the order's offer qty. */
  private mkOrder(p: ProductionOrder): DraftOrder {
    const ordered = generateOrdered(p.qty, parseInt(p.po.slice(-2), 10) || 1, COLOR_W, SIZE_W);
    return { po: p.po, pro: p.pro, articleCode: p.articleCode, style: p.style, orderQty: p.qty, ordered, offered: distribute(ordered, p.offer) };
  }

  protected async editOffer(i: number): Promise<void> {
    const o = this.orders()[i];
    const offered = await this.dialogs.editOffer(o, this.masters()!);
    if (!offered) return;
    this.orders.update((cur) => cur.map((x, k) => (k === i ? { ...x, offered } : x)));
    this.toast.success(this.t('Addons_OfferUpdated', { n: sumOf(offered).toLocaleString('en-US') }));
  }

  protected removeOrder(i: number): void {
    this.orders.update((cur) => cur.filter((_, k) => k !== i));
  }

  /** Prefill from a PWN or an existing inspection (fills type, article, buyer, supplier, assignee and its order). */
  protected async copyFrom(tab: 'pwn' | 'insp'): Promise<void> {
    const m = this.masters()!;
    const existing: InspectionCopySource[] = this.requests
      .query({ tab: 'active', search: '', from: null, to: null, page: 1, pageSize: 500, kind: 'inspection' })
      .items.concat(this.requests.query({ tab: 'completed', search: '', from: null, to: null, page: 1, pageSize: 500, kind: 'inspection' }).items)
      .map((r) => this.toCopySource(r, m));
    const src = await this.dialogs.copyInspection(m.pwn, existing, tab);
    if (!src) return;
    const art = m.articles.find((a) => a.code === src.articleCode);
    if (art) this.selectArticle(art);
    this.form.patchValue({ type: src.inspectionType, assignTo: src.assignTo });
    const po = m.productionOrders.find((p) => p.po === src.po);
    this.orders.set(po ? [this.mkOrder(po)] : []);
    this.copied.set(`✓ ${this.t('Addons_CopiedFrom', { src: src.key })}`);
  }

  private toCopySource(r: InspectionRequest, m: MastersData): InspectionCopySource {
    const art = m.articles.find((a) => a.code === r.articleCode);
    const o = r.orders[0];
    return {
      key: r.tranNum, articleCode: art?.code ?? r.articleCode, inspectionType: r.inspectionType.charAt(0) + r.inspectionType.slice(1).toLowerCase(),
      buyer: art?.buyer ?? '', supplier: art?.supplier ?? r.supplierName, assignTo: this.form.controls.assignTo.value || 'Arun Semwal', po: o?.orderRefNo ?? '', date: r.date,
    };
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
    if (!this.article()) return this.t('Addons_ErrArticle');
    if (!this.orders().length) return this.t('Addons_ErrOrders');
    if (!this.form.controls.type.value) return this.t('Addons_ErrType');
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
    const orders: Omit<OrderLine, 'qaRequestOrderId'>[] = this.orders().map((o) => ({
      orderRefNo: o.po, styleName: o.style, colorName: this.colorsOf(o), orderQty: o.orderQty, offeredQty: sumOf(o.offered), actualOfferedQty: null, acceptedQty: null,
      deliveryDate: v.targetDate || toIso(new Date()), status: null, syncState: 'none', isCompleted: false, matrix: { ordered: o.ordered, offered: o.offered },
    }));
    const draft: NewRequestDraft = {
      prefix: 'IR', kind: 'inspection', inspectionType: v.type.toUpperCase() + (/inspection/i.test(v.type) ? '' : ' INSPECTION'),
      articleCode: a.code, buyerRef: ` / ${a.trans}`, articleName: a.name.toUpperCase(), supplierName: (v.supplier || a.supplier).toUpperCase(), imageUrl: null,
      date: toIso(new Date()), dueDate: v.targetDate || v.scheduleDate || undefined, styleCount: orders.length, isInspectionCancel: false, isExpanderEnable: true, isNew: true,
      comment: v.comments, attachments: this.files().map((f, i) => ({ id: `up-${i}-${f.name}`, userFileName: f.name, fileUrl: `mock://upload/${f.name}` })), orders,
    };
    this.busy.set(true);
    try {
      const created = await this.repo.createRequest(draft);
      await this.requests.add(created);
      for (const o of created.orders) await this.forms.cacheConfig(o.qaRequestOrderId); // so the result can be entered offline
      const pcs = created.orders.reduce((s, o) => s + o.offeredQty, 0);
      const startNow = await this.confirm.ask(
        this.t('Addons_InspectionCreatedBody', { name: a.name, n: created.orders.length, pcs: pcs.toLocaleString('en-US') }),
        { title: this.t('Addons_InspectionCreated', { id: created.tranNum }), confirmLabel: this.t('Addons_StartResult'), cancelLabel: this.t('Addons_ResultLater') },
      );
      this.reset();
      if (startNow) await this.router.navigate(['/requests', created.qaRequestId, 'orders', created.orders[0].qaRequestOrderId, 'inspect']);
      else await this.router.navigate(['/requests'], { queryParams: { tab: 'active', kind: 'inspection' } });
    } catch {
      this.error.set(this.t('Msg_NoInternetConnection'));
    } finally {
      this.busy.set(false);
    }
  }

  private colorsOf(o: DraftOrder): string {
    const m = this.masters()!;
    const ns = m.sizes.length;
    return m.colors.filter((_, c) => o.offered.slice(c * ns, c * ns + ns).some((q) => q > 0)).map((c) => c.name).join(', ');
  }

  private reset(): void {
    this.form.reset(this.defaults);
    this.article.set(null);
    this.orders.set([]);
    this.files.set([]);
    this.copied.set('');
  }
}

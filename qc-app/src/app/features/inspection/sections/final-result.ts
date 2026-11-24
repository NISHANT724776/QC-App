import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { I18n } from '../../../core/i18n/i18n';
import { Settings } from '../../../core/settings/settings';
import { FinalData, FinalQtyRow } from '../../../domain/models/inspection';
import { acceptedMismatch, sumQty } from '../../../domain/rules/quantity.rule';
import { toWholeNumber } from '../../../domain/rules/summary.rule';
import { CalendarPicker } from '../../../shared/calendar-dialog';
import { Icon } from '../../../shared/icon';
import { PhotoPicker } from '../../../shared/photo-picker';
import { PhotoStrip } from '../../../shared/photo-strip';
import { SelectField } from '../../../shared/select-field';
import { InspectionStore } from '../inspection-store';
import { PhotoRenamer } from '../photo-rename';

const KEY = 'final';
type QtyField = 'accepted' | 'seconds' | 'scrap';

interface Pivot {
  sizes: string[];
  lines: { defect: string; color: string; cells: (FinalQtyRow | null)[]; total: number }[];
  colTotals: number[];
  grand: number;
}

/**
 * Final Result. Two UI sets as in the source app:
 *  - portrait: quantity lists (Color / Size / Qty), photos, Judgement Date, Judgement, remarks, signatures stacked
 *  - landscape: quantity matrices by size, photos, teal "Decision" bar (date + judgement), remarks, signatures side by side
 * Submit Result is in the page footer (inspection shell). Quantity blocks only appear when flagged.
 */
@Component({
  selector: 'app-final-result-section',
  imports: [DatePipe, NgTemplateOutlet, Icon, SelectField, PhotoStrip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.form(); as f) {
      @let fr = f.final;

      @if (fr.captureAccepted && mismatch()) {
        <div class="banner" role="alert">
          <span>{{ t('FinalResult_AcceptedQtyMismatchMessage') }}</span>
          @if (!store.locked()) {
            <button type="button" class="btn btn-outline" (click)="resetAccepted()">{{ t('Profile_Update') }}</button>
          }
        </div>
      }

      @if (fr.captureAccepted) { <ng-container *ngTemplateOutlet="qty; context: { field: 'accepted', title: t('FinalResult_AcceptedQty'), rows: fr.accepted, pv: accP(), defect: false }" /> }
      @if (fr.captureSeconds) { <ng-container *ngTemplateOutlet="qty; context: { field: 'seconds', title: t('FinalResult_SecondQty'), rows: fr.seconds, pv: secP(), defect: true }" /> }
      @if (fr.captureScrap) { <ng-container *ngTemplateOutlet="qty; context: { field: 'scrap', title: t('FinalResult_ScrapQty'), rows: fr.scrap, pv: scrP(), defect: true }" /> }

      <app-photo-strip [previewOnClick]="false" (photoOpen)="rename()" [photos]="fr.attachments" [readonly]="store.locked()" (add)="addPhotos()" (remove)="removePhoto($event)" />

      @if (landscape()) {
        <div class="decision">
          <span class="dt">{{ t('FinalResult_Decision') }}</span>
          <div class="dcol">
            <span class="sm">{{ t('FinalResult_JudgementDate') }}</span>
            <div class="datebox"><input class="datein" [value]="fr.judgementDate | date: 'MM/dd/yyyy'" readonly aria-label="Judgement date" />
              <button type="button" class="ic" (click)="pickDate()" [disabled]="store.locked()" [attr.aria-label]="t('Request_Calendar')"><app-icon name="calendar" [size]="28" /></button></div>
          </div>
          <div class="dcol">
            <span class="sm">{{ t('FinalResult_Judgement') }}</span>
            <app-select-field class="onbar" [options]="judgementOptions()" [value]="fr.judgementId" (valueChange)="patch({ judgementId: $any($event) })" [title]="t('FinalResult_Judgement')" [placeholder]="t('Common_SelectEllipsis')" [disabled]="store.locked()" />
          </div>
        </div>
      } @else {
        <span class="label big">{{ t('FinalResult_JudgementDate') }}</span>
        <div class="datebox plain"><input class="input" [value]="fr.judgementDate | date: 'MM/dd/yyyy'" readonly aria-label="Judgement date" />
          <button type="button" class="ic" (click)="pickDate()" [disabled]="store.locked()" [attr.aria-label]="t('Request_Calendar')"><app-icon name="calendar" [size]="32" /></button></div>
        <span class="label big">{{ t('FinalResult_Judgement') }}</span>
        <app-select-field [options]="judgementOptions()" [value]="fr.judgementId" (valueChange)="patch({ judgementId: $any($event) })" [title]="t('FinalResult_Judgement')" [placeholder]="t('Common_SelectEllipsis')" [disabled]="store.locked()" />
      }

      <textarea class="textarea remarks" [value]="fr.remarks" [placeholder]="t('Common_EnterYourRemarks')" [disabled]="store.locked()" aria-label="Remarks" (input)="patch({ remarks: $any($event.target).value })"></textarea>

      <div class="sigs" [class.ls]="landscape()">
        @for (s of sigs; track s.key) {
          <div class="sig">
            <span class="sl">{{ t(s.label) }}</span>
            <button type="button" class="pad" [class.ls]="landscape()" (click)="sign(s.key)" [disabled]="store.locked()" [attr.aria-label]="t(s.label)">
              @if (sigOf(fr, s.key); as img) {
                <img [src]="img" [alt]="t(s.label)" />
                <span class="edit"><app-icon name="edit" [size]="18" /></span>
              } @else {
                <span class="click">{{ t('FinalResult_ClickHereSignature') }}</span>
              }
            </button>
          </div>
        }
      </div>
    }

    <ng-template #qty let-field="field" let-title="title" let-rows="rows" let-pv="pv" let-defect="defect">
      <section class="qty">
        <h2>{{ title }}</h2>
        <div class="tablewrap">
          @if (landscape()) {
            <table class="mx">
              <thead><tr>
                @if (defect) {<th class="l" scope="col">{{ t('FinalResult_DefectType') }}</th>}
                <th class="l" scope="col">{{ t('Request_Color') }}</th>
                @for (s of pv.sizes; track s) {<th scope="col">{{ s }}</th>}
                <th scope="col">{{ t('Common_Total') }}</th>
              </tr></thead>
              <tbody>
                @for (l of pv.lines; track $index) {
                  <tr>
                    @if (defect) {<th class="l" scope="row">{{ l.defect }}</th>}
                    <th class="l" scope="row">{{ l.color }}</th>
                    @for (c of l.cells; track $index) {
                      <td>@if (c) {<input class="qty" inputmode="numeric" [value]="c.qty ?? ''" [disabled]="store.locked()" [attr.aria-label]="title + ' ' + l.defect + ' ' + c.sizeCode" (input)="setQty(field, c.id, $any($event.target))" />}</td>
                    }
                    <td class="n">{{ l.total }}</td>
                  </tr>
                }
              </tbody>
              <tfoot><tr>
                <th class="l" [attr.colspan]="defect ? 2 : 1" scope="row">{{ t('Common_TotalCaps') }}</th>
                @for (c of pv.colTotals; track $index) {<td class="n">{{ c }}</td>}
                <td class="n">{{ pv.grand }}</td>
              </tr></tfoot>
            </table>
          } @else {
            <table class="grid">
              <thead><tr>
                @if (defect) {<th class="l" scope="col">{{ t('FinalResult_DefectType') }}</th>}
                <th class="l" scope="col">{{ t('Request_Color') }}</th><th scope="col">{{ t('Common_Size') }}</th><th class="r" scope="col">{{ title }}</th>
              </tr></thead>
              <tbody>
                @for (r of rows; track r.id) {
                  <tr>
                    @if (defect) {<td class="l dim">{{ r.defectName }}</td>}
                    <td class="l dim">{{ r.colorName }}</td><td class="dim">{{ r.sizeCode }}</td>
                    <td class="r"><input class="qty" inputmode="numeric" [value]="r.qty ?? ''" [disabled]="store.locked()" [attr.aria-label]="title + ' ' + r.defectName + ' ' + r.sizeCode" (input)="setQty(field, r.id, $any($event.target))" /></td>
                  </tr>
                }
              </tbody>
              <tfoot><tr><th class="l" [attr.colspan]="defect ? 3 : 2" scope="row">{{ t('Common_Total') }}</th><td class="r">{{ pv.grand }}</td></tr></tfoot>
            </table>
          }
        </div>
      </section>
    </ng-template>
  `,
  styles: `
    .label.big{display:block;font-size:16px;color:#333;margin:12px 0 4px}
    .banner{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 14px;background:#fff4d6;color:#6b4e00;margin-bottom:12px}
    .banner span{flex:1}
    .qty{margin-bottom:14px}
    h2{margin:6px 0;font-size:18px;font-weight:600;color:#444}
    .tablewrap{overflow-x:auto}
    .grid{width:100%;border-collapse:collapse;text-align:center}
    .grid th,.grid td{padding:6px 8px}
    .grid thead th{font-weight:600;border-bottom:2px solid #333}
    .grid tbody td{border-bottom:1px solid var(--line)}
    .grid .l{text-align:left}.grid .r{text-align:right}
    .dim{color:#777;font-weight:300}
    .grid tfoot th,.grid tfoot td{font-weight:700;border-top:2px solid #333}
    input.qty{width:100%;max-width:120px;min-height:44px;border:0;background:#f7f7f7;text-align:right;padding:0 8px;font-size:15px;color:#555;display:block;margin-left:auto}
    input.qty:focus{outline:2px solid var(--brand);background:#fff}
    .mx{border-collapse:collapse;min-width:100%;font-size:14px}
    .mx th,.mx td{padding:4px 6px;text-align:center;border:1px solid #fff;white-space:nowrap}
    .mx thead th{background:#3dbccb;color:#fff;font-weight:600}
    .mx .l{text-align:left;font-weight:400}.mx thead .l{font-weight:600}
    .mx td.n{background:#fff;border-bottom:1px solid var(--line);text-align:right;min-width:60px}
    .mx input.qty{max-width:76px;min-height:36px}
    .mx tfoot th,.mx tfoot td{background:#f0f0f0;font-weight:600}
    .datebox{display:flex;align-items:center;gap:8px}
    .datebox.plain .input{flex:1}
    .ic{width:48px;height:48px;border:0;background:transparent;border-radius:50%;cursor:pointer;color:#37474f;flex:none}
    .ic:hover:not(:disabled){background:var(--brand-soft)}
    .decision{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px 24px;padding:10px 14px;background:#3dbccb;color:#fff;margin:10px 0}
    .dt{font-size:20px;align-self:center;min-width:120px}
    .dcol{display:grid;gap:2px;min-width:200px;flex:1}
    .sm{font-size:12px}
    .datein{flex:1;min-height:30px;border:0;border-bottom:1px solid #fff;background:transparent;color:#fff;font-size:14px;outline:0;min-width:0}
    .decision .ic{color:#fff;width:40px;height:40px}
    .onbar{--surface:transparent;--line-strong:#fff;color:#fff;display:block}
    ::ng-deep .onbar .field{color:#fff}
    .remarks{margin-top:12px;min-height:64px}
    .sigs{display:grid;gap:12px;margin-top:12px}
    .sigs.ls{grid-template-columns:1fr 1fr;gap:20px}
    .sl{display:block;font-weight:700;color:#444;margin-bottom:6px}
    .pad{position:relative;width:100%;height:215px;border:1px solid var(--line-strong);background:#fff;display:grid;place-items:center;cursor:pointer;overflow:hidden}
    .pad.ls{height:170px}
    .pad:hover:not(:disabled){border-color:var(--brand)}
    .pad img{max-width:100%;max-height:100%}
    .click{color:var(--brand-dark)}
    .edit{position:absolute;right:8px;top:8px;color:var(--muted)}
  `,
})
export class FinalResultSection implements OnInit {
  protected readonly store = inject(InspectionStore);
  protected readonly t = inject(I18n).t;
  protected readonly landscape = inject(Settings).landscape;
  private readonly picker = inject(PhotoPicker);
  private readonly renamer = inject(PhotoRenamer);
  private readonly calendar = inject(CalendarPicker);
  private readonly dialog = inject(MatDialog);

  protected readonly sigs = [
    { key: 'qcSignature' as const, label: 'FinalResult_QCSignature' },
    { key: 'frSignature' as const, label: 'FinalResult_FRSignature' },
  ];

  protected readonly judgementOptions = computed(() => (this.store.form()?.final.judgements ?? []).map((j) => ({ id: j.id, label: j.name })));
  protected readonly mismatch = computed(() => {
    const f = this.store.form();
    return f ? acceptedMismatch(f.final.accepted, this.store.totals()?.offered ?? 0) : false;
  });
  protected readonly accP = computed(() => this.pivot(this.store.form()?.final.accepted ?? []));
  protected readonly secP = computed(() => this.pivot(this.store.form()?.final.seconds ?? []));
  protected readonly scrP = computed(() => this.pivot(this.store.form()?.final.scrap ?? []));

  ngOnInit(): void {
    this.store.activeSection.set(KEY);
  }

  /** rows -> matrix (defect/color lines x size columns) for the landscape view; also gives totals for both views */
  private pivot(rows: FinalQtyRow[]): Pivot {
    const sizes = [...new Set(rows.map((r) => r.sizeCode))];
    const map = new Map<string, Pivot['lines'][number]>();
    for (const r of rows) {
      const key = `${r.defectName}|${r.colorName}`;
      if (!map.has(key)) map.set(key, { defect: r.defectName, color: r.colorName, cells: sizes.map(() => null), total: 0 });
      const l = map.get(key)!;
      l.cells[sizes.indexOf(r.sizeCode)] = r;
      l.total += r.qty || 0;
    }
    return {
      sizes,
      lines: [...map.values()],
      colTotals: sizes.map((s) => sumQty(rows.filter((r) => r.sizeCode === s))),
      grand: sumQty(rows),
    };
  }

  protected rename(): void {
    void this.renamer.open(this.store, KEY);
  }

  protected sigOf(f: FinalData, k: 'qcSignature' | 'frSignature'): string | null {
    return f[k];
  }

  protected patch(p: Partial<FinalData>): void {
    this.store.update(KEY, 'final', (f) => ({ ...f, ...p }));
  }

  protected setQty(field: QtyField, id: string, el: HTMLInputElement): void {
    const digits = el.value.replace(/\D/g, '');
    if (digits !== el.value) el.value = digits;
    const qty = toWholeNumber(digits);
    this.store.update(KEY, 'final', (f) => ({ ...f, [field]: f[field].map((r) => (r.id === id ? { ...r, qty } : r)) }));
  }

  /** ASSUMED semantics of the mismatch banner's "Update" (docs Q-10): fill accepted qty from the summary's offered qty. */
  protected resetAccepted(): void {
    const offered = new Map(this.store.form()!.summary.rows.map((r) => [r.id, r.offered ?? 0]));
    this.store.update(KEY, 'final', (f) => ({ ...f, accepted: f.accepted.map((r) => ({ ...r, qty: offered.get(r.id.split('|')[0]) ?? 0 })) }));
  }

  protected async pickDate(): Promise<void> {
    const res = await this.calendar.pick(this.store.form()!.final.judgementDate, [], false);
    if (res && 'date' in res) this.patch({ judgementDate: res.date });
  }

  protected async addPhotos(): Promise<void> {
    const photos = await this.picker.pick();
    if (photos.length) this.store.update(KEY, 'final', (f) => ({ ...f, attachments: [...f.attachments, ...photos] }));
  }

  protected removePhoto(id: string): void {
    this.store.update(KEY, 'final', (f) => ({ ...f, attachments: f.attachments.filter((p) => p.id !== id) }));
  }

  protected async sign(k: 'qcSignature' | 'frSignature'): Promise<void> {
    const { SignatureDialog } = await import('../../../shared/signature-dialog');
    const ref = this.dialog.open<InstanceType<typeof SignatureDialog>, { title: string; existing: string | null }, string>(SignatureDialog, {
      data: { title: this.t(k === 'qcSignature' ? 'FinalResult_QCSignature' : 'FinalResult_FRSignature'), existing: this.store.form()!.final[k] },
      maxWidth: '96vw',
    });
    const img = await firstValueFrom(ref.afterClosed());
    if (img) this.patch({ [k]: img });
  }
}

import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { I18n } from '../../../core/i18n/i18n';
import { Settings } from '../../../core/settings/settings';
import { SummaryRow } from '../../../domain/models/inspection';
import { resizeCartonNumbers, toWholeNumber } from '../../../domain/rules/summary.rule';
import { Option, SelectField } from '../../../shared/select-field';
import { InspectionStore } from '../inspection-store';

const KEY = 'summary';

/**
 * Summary tab. Two UI sets as in the source app:
 *  - portrait: "Standard" picker, Color / Size / Ordered / Offered / Inspected list, Total, Sample Size, Variance
 *  - landscape: Original Standard (read-only) + Revise Standard, colour x size matrix (Ordered / Offered / Inspected
 *    per size, Total group with Variance) and a TOTAL row. Cartons offered/inspected + carton numbers in both.
 */
@Component({
  selector: 'app-summary-section',
  imports: [SelectField, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.form(); as f) {
      @if (landscape()) {
        <div class="std ls">
          <div>
            <span class="label">{{ t('Summary_OriginalStandard') }}</span>
            <input class="input" [value]="f.summary.originalStandard" readonly aria-label="Original standard" />
          </div>
          <div>
            <span class="label">{{ t('Summary_ReviseStandard') }}</span>
            <app-select-field [options]="standards()" [value]="f.summary.reviseStandard" (valueChange)="setStandard($any($event))"
              [title]="t('Summary_ReviseStandard')" [placeholder]="t('Summary_SelectStandard')" [disabled]="store.locked()" />
          </div>
        </div>

        <div class="tablewrap">
          <table class="mx">
            <caption class="sr-only">{{ t('Section_Summary') }}</caption>
            <thead>
              <tr>
                <th rowspan="2" class="color" scope="col">{{ t('Request_Color') }}</th>
                @for (s of matrix().sizes; track s) {<th colspan="3" scope="colgroup">{{ s }}</th>}
                <th colspan="4" scope="colgroup">{{ t('Common_Total') }}</th>
              </tr>
              <tr>
                @for (s of matrix().sizes; track s) {
                  <th scope="col">{{ t('Request_Ordered') }}</th><th scope="col">{{ t('Request_Offered') }}</th><th scope="col">{{ t('Summary_Inspected') }}</th>
                }
                <th scope="col">{{ t('Request_Ordered') }}</th><th scope="col">{{ t('Request_Offered') }}</th><th scope="col">{{ t('Summary_Inspected') }}</th><th scope="col">{{ t('Summary_VarianceHeader') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (c of matrix().colors; track c.key) {
                <tr>
                  <th scope="row" class="color">{{ c.label }}</th>
                  @for (cell of c.cells; track $index) {
                    @if (cell) {
                      <td class="n">{{ cell.ordered | number: '1.4-4' }}</td>
                      <td><input class="qty" inputmode="numeric" [value]="cell.offered ?? ''" [disabled]="store.locked()" [attr.aria-label]="'Offered ' + cell.sizeCode" (input)="setQty(cell.id, 'offered', $any($event.target))" /></td>
                      <td><input class="qty" inputmode="numeric" [value]="cell.inspected ?? ''" [disabled]="store.locked()" [attr.aria-label]="'Inspected ' + cell.sizeCode" (input)="setQty(cell.id, 'inspected', $any($event.target))" /></td>
                    } @else {
                      <td></td><td></td><td></td>
                    }
                  }
                  <td class="n">{{ c.ordered }}</td><td class="n">{{ c.offered }}</td><td class="n">{{ c.inspected }}</td><td></td>
                </tr>
              }
              <tr class="tot">
                <th scope="row" class="color">{{ t('Common_TotalCaps') }}</th>
                @for (s of matrix().sizeTotals; track $index) {
                  <td class="n">{{ s.ordered }}</td><td class="n">{{ s.offered }}</td><td class="n">{{ s.inspected }}</td>
                }
                <td class="n">{{ store.totals()?.ordered }}</td><td class="n">{{ store.totals()?.offered }}</td><td class="n">{{ store.totals()?.inspected }}</td><td class="n">{{ store.totals()?.variance }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      } @else {
        <span class="label big">{{ t('Summary_Standard') }}</span>
        <app-select-field class="stdsel" [options]="standards()" [value]="f.summary.reviseStandard" (valueChange)="setStandard($any($event))"
          [title]="t('Summary_Standard')" [placeholder]="t('Summary_SelectStandard')" [disabled]="store.locked()" />

        <div class="tablewrap">
          <table class="grid">
            <caption class="sr-only">{{ t('Section_Summary') }}</caption>
            <thead>
              <tr>
                <th scope="col" class="l">{{ t('Request_Color') }}</th>
                <th scope="col">{{ t('Common_Size') }}</th>
                <th scope="col">{{ t('Request_Ordered') }}</th>
                <th scope="col" class="r">{{ t('Request_Offered') }}</th>
                <th scope="col" class="r">{{ t('Summary_Inspected') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (r of f.summary.rows; track r.id) {
                <tr>
                  <td class="l dim">{{ r.colorName }} {{ r.colorCode }}</td>
                  <td class="dim">{{ r.sizeCode }}</td>
                  <td class="dim">{{ r.ordered | number: '1.4-4' }}</td>
                  <td class="r"><input class="qty" inputmode="numeric" [value]="r.offered ?? ''" [disabled]="store.locked()" [attr.aria-label]="'Offered ' + r.sizeCode" (input)="setQty(r.id, 'offered', $any($event.target))" /></td>
                  <td class="r"><input class="qty" inputmode="numeric" [value]="r.inspected ?? ''" [disabled]="store.locked()" [attr.aria-label]="'Inspected ' + r.sizeCode" (input)="setQty(r.id, 'inspected', $any($event.target))" /></td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" class="l" colspan="3">{{ t('Common_Total') }}</th>
                <td class="r">{{ store.totals()?.offered }}</td>
                <td class="r">{{ store.totals()?.inspected }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="calc" role="group" aria-label="Sample size and variance">
          <span>{{ t('Summary_SampleSize') }} : <b>{{ store.totals()?.sampleSize }}</b></span>
          <span>{{ t('Summary_Variance') }} : <b>{{ store.totals()?.variance }}</b></span>
        </div>
      }

      <div class="cartons">
        <div>
          <label class="label big" for="co">{{ t('Summary_CartonsOffered') }}</label>
          <input id="co" class="input num" inputmode="numeric" maxlength="9" [value]="f.summary.cartonsOffered" [disabled]="store.locked()" (input)="setCartons('cartonsOffered', $any($event.target), 9)" />
        </div>
        <div>
          <label class="label big" for="ci">{{ t('Summary_CartonsInspected') }}</label>
          <input id="ci" class="input num" inputmode="numeric" maxlength="3" [value]="f.summary.cartonsInspected" [disabled]="store.locked()" (input)="setCartons('cartonsInspected', $any($event.target), 3)" />
        </div>
      </div>

      @if (f.summary.cartonNumbers.length) {
        <div class="cnums">
          @for (c of f.summary.cartonNumbers; track $index) {
            <input class="input num" [value]="c" [placeholder]="'c' + ($index + 1)" [disabled]="store.locked()" [attr.aria-label]="t('Summary_CartonNo') + ' ' + ($index + 1)" (input)="setCartonNo($index, $any($event.target).value)" />
          }
        </div>
      }
    }
  `,
  styles: `
    .label.big{font-size:16px;color:#333;margin:4px 0}
    .std.ls{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-bottom:16px;max-width:1040px}
    .stdsel{display:block;margin-bottom:12px}
    .tablewrap{overflow-x:auto;margin-bottom:8px}
    /* portrait list */
    .grid{width:100%;border-collapse:collapse;min-width:420px}
    .grid th,.grid td{padding:6px 8px;text-align:center;vertical-align:middle}
    .grid thead th{font-weight:600;font-size:15px;color:#333;border-bottom:2px solid #333}
    .grid tbody td{border-bottom:1px solid var(--line)}
    .grid .l{text-align:left}.grid .r{text-align:right}
    .dim{color:#777;font-weight:300}
    .qty{width:100%;max-width:120px;min-height:48px;border:0;background:#f7f7f7;text-align:right;padding:0 8px;font-size:15px;color:#777}
    .qty:focus{outline:2px solid var(--brand);background:#fff;color:var(--text)}
    .grid tfoot th,.grid tfoot td{font-weight:700;border-top:2px solid #333;border-bottom:2px solid #333}
    .calc{display:flex;justify-content:space-between;margin:16px 0;font-size:16px}
    /* landscape matrix */
    .mx{border-collapse:collapse;min-width:100%;font-size:14px}
    .mx th,.mx td{padding:4px 6px;text-align:center;border:1px solid #fff;white-space:nowrap}
    .mx thead th{background:#3dbccb;color:#fff;font-weight:600}
    .mx .color{text-align:left;min-width:150px;font-weight:400}
    .mx thead .color{text-align:center;font-weight:600}
    .mx td.n{text-align:right;background:#fff;border-bottom:1px solid var(--line);min-width:64px}
    .mx .qty{max-width:84px;min-height:36px}
    .mx tr.tot th,.mx tr.tot td{background:#f0f0f0;font-weight:600}
    .cartons{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px}
    .cnums{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:12px;margin-top:16px}
    @media (max-width:420px){.cartons{grid-template-columns:1fr}}
  `,
})
export class SummarySection implements OnInit {
  protected readonly store = inject(InspectionStore);
  protected readonly t = inject(I18n).t;
  protected readonly landscape = inject(Settings).landscape;
  protected readonly standards = computed<Option[]>(() => (this.store.form()?.summary.standards ?? []).map((s) => ({ id: s, label: s })));

  /** colour x size matrix for the landscape view */
  protected readonly matrix = computed(() => {
    const rows = this.store.form()?.summary.rows ?? [];
    const sizes = [...new Set(rows.map((r) => r.sizeCode))];
    const colors = new Map<string, { key: string; label: string; cells: (SummaryRow | null)[]; ordered: number; offered: number; inspected: number }>();
    for (const r of rows) {
      const key = `${r.colorName}|${r.colorCode}`;
      if (!colors.has(key)) colors.set(key, { key, label: r.colorName === r.colorCode ? `${r.colorName} (${r.colorCode})` : `${r.colorName} (${r.colorCode})`, cells: sizes.map(() => null), ordered: 0, offered: 0, inspected: 0 });
      const c = colors.get(key)!;
      c.cells[sizes.indexOf(r.sizeCode)] = r;
      c.ordered += r.ordered || 0;
      c.offered += r.offered || 0;
      c.inspected += r.inspected || 0;
    }
    const sizeTotals = sizes.map((s) => {
      const rs = rows.filter((r) => r.sizeCode === s);
      return { ordered: rs.reduce((a, r) => a + (r.ordered || 0), 0), offered: rs.reduce((a, r) => a + (r.offered || 0), 0), inspected: rs.reduce((a, r) => a + (r.inspected || 0), 0) };
    });
    return { sizes, colors: [...colors.values()], sizeTotals };
  });

  ngOnInit(): void {
    this.store.activeSection.set(KEY);
  }

  protected setStandard(v: string): void {
    this.store.update(KEY, 'summary', (s) => ({ ...s, reviseStandard: v }));
  }

  /** Whole numbers only (BR-S1); non-digits are stripped as the user types. */
  protected setQty(id: string, field: 'offered' | 'inspected', el: HTMLInputElement): void {
    const digits = el.value.replace(/\D/g, '');
    if (digits !== el.value) el.value = digits;
    const n = toWholeNumber(digits);
    this.store.update(KEY, 'summary', (s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? { ...r, [field]: n } : r)) }));
  }

  protected setCartons(field: 'cartonsOffered' | 'cartonsInspected', el: HTMLInputElement, max: number): void {
    const digits = el.value.replace(/\D/g, '').slice(0, max);
    if (digits !== el.value) el.value = digits;
    this.store.update(KEY, 'summary', (s) =>
      field === 'cartonsInspected'
        ? { ...s, cartonsInspected: digits, cartonNumbers: resizeCartonNumbers(s.cartonNumbers, digits) }
        : { ...s, cartonsOffered: digits },
    );
  }

  protected setCartonNo(i: number, v: string): void {
    this.store.update(KEY, 'summary', (s) => ({ ...s, cartonNumbers: s.cartonNumbers.map((c, idx) => (idx === i ? v : c)) }));
  }
}

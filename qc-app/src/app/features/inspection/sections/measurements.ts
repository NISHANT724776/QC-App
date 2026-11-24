import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { I18n } from '../../../core/i18n/i18n';
import { Settings } from '../../../core/settings/settings';
import { MeasurementPom, MeasurementSize } from '../../../domain/models/inspection';
import { ToleranceResult, evaluateTolerance } from '../../../domain/rules/tolerance.rule';
import { Icon } from '../../../shared/icon';
import { Option, SelectField } from '../../../shared/select-field';
import { InspectionStore } from '../inspection-store';

const KEY = 'measurements';

/**
 * Measurement Evaluation (C3): one tab per size; POM rows with Required, +/- tolerance and Actual
 * columns per sample. Each sample has a colour; samples can be added (+) and deleted.
 * Actuals outside tolerance are highlighted (red + icon, BR-M3). Values are fractional inches.
 */
@Component({
  selector: 'app-measurements-section',
  imports: [Icon, SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (size(); as sz) {
      <div class="sizes" role="tablist" [attr.aria-label]="t('Common_Size')">
        @for (s of sizeCodes(); track s) {
          <button role="tab" type="button" [attr.aria-selected]="s === sz.sizeCode" [class.on]="s === sz.sizeCode" (click)="selected.set(s)">{{ s }}</button>
        }
      </div>

      <div class="wrap">
        <table class="grid" [class.ls]="landscape()">
          <caption class="sr-only">{{ t('Section_Measurements') }} – {{ sz.sizeCode }}</caption>
          <thead>
            <tr>
              <th scope="col" class="pom" rowspan="2">{{ landscape() ? t('Measurement_PointOfMeasurement') : t('Measurement_POM') }}</th>
              <th scope="col" rowspan="2">{{ t('Measurement_Required') }}</th>
              <th scope="col" colspan="2">{{ t('Measurement_Tolerance') }}</th>
              @for (sm of sz.samples; track $index) {
                <th scope="col" rowspan="2" class="smp">
                  <div class="smphead">
                    <span>{{ t('Measurement_ActualPrefix') }}{{ landscape() || sz.samples.length > 1 ? ' ' + ($index + 1) : '' }}</span>
                    @if (sz.samples.length > 1 && !store.locked()) {
                      <button type="button" class="del" (click)="removeSample($index)" [attr.aria-label]="t('Measurement_DeleteSample') + ' ' + ($index + 1)"><app-icon name="close" [size]="16" /></button>
                    }
                  </div>
                  <app-select-field [options]="colors()" [value]="sm.color" (valueChange)="setColor($index, $any($event))" [title]="t('Measurement_Color')" [placeholder]="t('Measurement_Color')" [disabled]="store.locked()" />
                </th>
              }
            </tr>
            <tr><th scope="col" class="tol">{{ landscape() ? t('Measurement_PositiveToleranceLs') : t('Measurement_PositiveTolerance') }}</th><th scope="col" class="tol">{{ landscape() ? t('Measurement_NegativeToleranceLs') : t('Measurement_NegativeTolerance') }}</th></tr>
          </thead>
          <tbody>
            @for (p of sz.poms; track p.code) {
              <tr>
                <th scope="row" class="pom">
                  {{ p.code }} - {{ p.name }}
                  @if (p.critical) {
                    <span class="crit" [title]="t('Measurement_Critical')">{{ t('Measurement_Critical') }}</span>
                  }
                </th>
                <td>{{ p.required }}</td>
                <td>{{ p.tolPositive }}</td>
                <td>{{ p.tolNegative }}</td>
                @for (a of p.actuals; track $index) {
                  <td class="act">
                    @let res = tol(p, a);
                    <div class="cell" [class.out]="res === 'out'" [class.bad]="res === 'invalid'">
                      <input class="input num" inputmode="text" autocomplete="off" [value]="a" [disabled]="store.locked()"
                        [attr.aria-label]="p.code + ' ' + t('Measurement_ActualPrefix') + ' ' + ($index + 1)"
                        [attr.aria-invalid]="res === 'invalid' || res === 'out'"
                        (input)="setActual(p.code, $index, $any($event.target).value)" />
                      @if (res === 'out') {
                        <app-icon name="warning" [size]="16" class="ico" />
                        <span class="sr-only">{{ t('Measurement_OutOfTolerance') }}</span>
                      } @else if (res === 'invalid') {
                        <span class="hint" role="alert">{{ t('Measurement_InvalidValue') }}</span>
                      }
                    </div>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (!store.locked()) {
        <button type="button" class="fab" (click)="addSample()" [attr.aria-label]="t('Measurement_AddSample')" [title]="t('Measurement_AddSample')"><app-icon name="add" [size]="28" /></button>
      }
    }
  `,
  styles: `
    .sizes{display:flex;overflow-x:auto;background:var(--surface-2);margin-bottom:8px}
    .sizes button{flex:1 0 64px;min-height:48px;border:0;border-bottom:3px solid transparent;background:transparent;font:inherit;font-size:15px;cursor:pointer}
    .sizes button.on{border-bottom-color:var(--brand);color:var(--brand-dark);font-weight:700;background:#fff}
    .wrap{overflow:auto;max-height:calc(100vh - 380px);min-height:260px;border:1px solid var(--line);border-radius:8px}
    .grid{border-collapse:separate;border-spacing:0;width:100%;min-width:640px}
    .grid th,.grid td{padding:4px 8px;border-bottom:1px solid var(--line);text-align:center;background:#fff;font-weight:400}
    .grid thead th{background:#fff;color:#222;font-weight:600;position:sticky;top:0;z-index:2;border-bottom:2px solid var(--line)}
    .grid.ls thead th{background:#3dbccb;color:#fff;border-bottom:1px solid #fff3}
    .grid:not(.ls) tbody td,.grid:not(.ls) tbody th{color:#8a8f92}
    .grid thead tr:nth-child(2) th{top:34px;font-size:12px}
    .pom{text-align:left!important;min-width:220px;max-width:300px;position:sticky;left:0;z-index:1;font-size:12.5px!important;color:#4a575d}
    thead .pom{z-index:3}
    .grid tbody th.pom{background:#fff;box-shadow:1px 0 0 var(--line)}
    .smp{min-width:150px}
    .smphead{display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:4px}
    .del{width:28px;height:28px;border:0;border-radius:50%;background:#0001;color:inherit;cursor:pointer;display:grid;place-items:center}
    .del:hover{background:#fff4}
    .smp app-select-field{color:var(--text);font-weight:400;font-size:13px}
    .crit{margin-left:6px;font-size:10px;font-weight:700;color:#fff;background:var(--danger);border-radius:4px;padding:1px 5px;vertical-align:middle}
    .cell{position:relative}
    .cell .input{min-width:96px;text-align:right}
    .cell.out .input{border-color:var(--danger);color:var(--danger);background:var(--danger-soft);font-weight:600}
    .cell.bad .input{border-color:var(--warn);background:#fff8e1}
    .ico{position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--danger)}
    .hint{display:block;font-size:11px;color:#8a6200;text-align:left}
    @media (max-width:600px){
      .grid{min-width:520px}
      .pom{min-width:130px;max-width:150px;font-size:11px!important}
      .smp{min-width:128px}
      .cell .input{min-width:84px}
      .wrap{max-height:none}
    }
    .fab{position:fixed;right:20px;bottom:88px;width:56px;height:56px;border-radius:50%;border:0;background:var(--grad);color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 3px 10px rgb(0 0 0 / 30%);z-index:6}
  `,
})
export class MeasurementsSection implements OnInit {
  protected readonly store = inject(InspectionStore);
  protected readonly t = inject(I18n).t;
  protected readonly selected = signal<string | null>(null);
  protected readonly landscape = inject(Settings).landscape;

  protected readonly sizeCodes = computed(() => this.store.form()?.measurement.sizes.map((s) => s.sizeCode) ?? []);
  protected readonly size = computed(() => {
    const sizes = this.store.form()?.measurement.sizes ?? [];
    return sizes.find((s) => s.sizeCode === this.selected()) ?? sizes[0] ?? null;
  });
  protected readonly colors = computed<Option[]>(() => (this.store.form()?.measurement.colors ?? []).map((c) => ({ id: c, label: c })));

  ngOnInit(): void {
    this.store.activeSection.set(KEY);
  }

  protected tol(p: MeasurementPom, actual: string): ToleranceResult {
    return evaluateTolerance(actual, p.required, p.tolPositive, p.tolNegative);
  }

  private updateSize(fn: (s: MeasurementSize) => MeasurementSize): void {
    const code = this.size()?.sizeCode;
    this.store.update(KEY, 'measurement', (m) => ({ ...m, sizes: m.sizes.map((s) => (s.sizeCode === code ? fn(s) : s)) }));
  }

  protected setActual(pomCode: string, sample: number, value: string): void {
    this.updateSize((s) => ({ ...s, poms: s.poms.map((p) => (p.code === pomCode ? { ...p, actuals: p.actuals.map((a, i) => (i === sample ? value : a)) } : p)) }));
  }

  protected setColor(sample: number, color: string): void {
    this.updateSize((s) => ({ ...s, samples: s.samples.map((x, i) => (i === sample ? { color } : x)) }));
  }

  protected addSample(): void {
    this.updateSize((s) => ({ ...s, samples: [...s.samples, { color: s.samples[s.samples.length - 1]?.color ?? null }], poms: s.poms.map((p) => ({ ...p, actuals: [...p.actuals, ''] })) }));
  }

  protected removeSample(i: number): void {
    this.updateSize((s) => (s.samples.length <= 1 ? s : { ...s, samples: s.samples.filter((_, x) => x !== i), poms: s.poms.map((p) => ({ ...p, actuals: p.actuals.filter((_, x) => x !== i) })) }));
  }
}

import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { clampCount } from '../domain/rules/defect.rule';
import { Icon } from './icon';

/** − [ n ] + counter with 44 px touch targets (Major / Minor / Micro in defect capture). */
@Component({
  selector: 'app-counter-stepper',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stepper" [class.warn]="warn()">
      <button type="button" (click)="set(value() - 1)" [disabled]="disabled() || value() <= 0" [attr.aria-label]="'Decrease ' + label()"><app-icon name="remove" /></button>
      <input inputmode="numeric" [value]="value()" [disabled]="disabled()" [attr.aria-label]="label()" (change)="onType($any($event.target))" (focus)="$any($event.target).select()" />
      <button type="button" (click)="set(value() + 1)" [disabled]="disabled()" [attr.aria-label]="'Increase ' + label()"><app-icon name="add" /></button>
    </div>
  `,
  styles: `
    .stepper{display:inline-flex;align-items:center;gap:2px}
    button{width:36px;height:44px;border:0;background:transparent;color:var(--brand);cursor:pointer;display:grid;place-items:center;border-radius:6px}
    button:hover:not(:disabled),button:focus-visible{background:var(--brand-soft)}
    button:disabled{color:var(--line-strong);cursor:not-allowed}
    input{width:48px;height:40px;text-align:center;border:1px solid var(--line-strong);border-radius:6px;font:inherit;background:var(--surface)}
    input:focus{outline:2px solid var(--brand);outline-offset:0}
    .warn input{border-color:var(--danger);color:var(--danger)}
  `,
})
export class CounterStepper {
  readonly value = model(0);
  readonly label = input('');
  readonly disabled = input(false);
  readonly warn = input(false);

  protected set(n: number): void {
    this.value.set(clampCount(n));
  }
  protected onType(el: HTMLInputElement): void {
    const n = clampCount(Number(el.value));
    el.value = String(n);
    this.value.set(n);
  }
}

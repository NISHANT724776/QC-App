import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { Option } from './select-field';

/** Segmented control (Day / Week / Month, Active / Completed …). */
@Component({
  selector: 'app-segmented',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="seg" role="radiogroup" [attr.aria-label]="label()">
      @for (o of options(); track o.id) {
        <button type="button" role="radio" [attr.aria-checked]="o.id === value()" [class.on]="o.id === value()" (click)="value.set(o.id)">{{ o.label }}</button>
      }
    </div>
  `,
  styles: `
    .seg{display:inline-flex;background:#dfe3e5;border-radius:6px;padding:2px;gap:2px}
    button{min-width:56px;min-height:36px;padding:0 12px;border:0;border-radius:5px;background:transparent;font:inherit;font-size:13px;font-weight:600;color:#5b676d;cursor:pointer}
    button.on{background:var(--brand);color:#fff}
    button:focus-visible{outline:2px solid var(--brand-dark);outline-offset:1px}
  `,
})
export class Segmented {
  readonly options = input.required<Option[]>();
  readonly value = model<string>('');
  readonly label = input('');
}

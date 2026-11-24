import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { Option } from './select-field';

/**
 * Single-choice chips for short judgement lists (Confirmed / No Confirmed, Approved / Rejected).
 * Tapping the selected chip again clears it (the source app had a "Select" placeholder state).
 * Options still come from the server-supplied list.
 */
@Component({
  selector: 'app-chip-choice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chips" role="radiogroup" [attr.aria-label]="label()">
      @for (o of options(); track o.id) {
        <button type="button" role="radio" [attr.aria-checked]="o.id === value()" [class.on]="o.id === value()" [class.bad]="o.id === value() && isNegative(o.label)"
          [disabled]="disabled()" (click)="value.set(o.id === value() ? null : o.id)">{{ o.label }}</button>
      }
    </div>
  `,
  styles: `
    .chips{display:flex;flex-wrap:wrap;gap:6px}
    button{min-height:40px;padding:0 14px;border:1px solid var(--line-strong);border-radius:999px;background:#fff;font:inherit;font-size:13px;color:#4a575d;cursor:pointer}
    button:hover:not(:disabled){border-color:var(--brand)}
    button.on{background:var(--ok);border-color:var(--ok);color:#fff;font-weight:600}
    button.on.bad{background:var(--danger);border-color:var(--danger)}
    button:disabled{opacity:.6;cursor:not-allowed}
  `,
})
export class ChipChoice {
  readonly options = input.required<Option[]>();
  readonly value = model<string | null>(null);
  readonly label = input('');
  readonly disabled = input(false);

  /** Colour hint only – never used for logic. */
  protected isNegative(label: string): boolean {
    return /^(no|not|reject|fail)/i.test(label);
  }
}

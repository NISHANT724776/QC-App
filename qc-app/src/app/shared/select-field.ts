import { ChangeDetectionStrategy, Component, Injectable, computed, inject, input, model } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { I18n } from '../core/i18n/i18n';
import { Icon } from './icon';

export interface Option {
  id: string;
  label: string;
}

interface PickData {
  title: string;
  options: Option[];
  selectedId: string | null;
}

/** Popup selection list – same pattern the source app used instead of native pickers. */
@Component({
  selector: 'app-select-dialog',
  imports: [MatDialogModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <ul class="list" role="listbox">
        @for (o of data.options; track o.id) {
          <li>
            <button type="button" role="option" [attr.aria-selected]="o.id === data.selectedId" [class.sel]="o.id === data.selectedId" (click)="ref.close(o.id)">
              <span>{{ o.label }}</span>
              @if (o.id === data.selectedId) {
                <app-icon name="check" />
              }
            </button>
          </li>
        }
      </ul>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button class="btn btn-text" mat-dialog-close>{{ t('Common_Cancel') }}</button></mat-dialog-actions>
  `,
  styles: `
    .list{list-style:none;margin:0;padding:0;min-width:min(300px,80vw)}
    button{width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:48px;padding:0 12px;border:0;
      border-bottom:1px solid var(--line);background:#fff;font:inherit;text-align:left;cursor:pointer}
    button:hover,button:focus-visible{background:var(--brand-soft)}
    .sel{color:var(--brand);font-weight:600}
  `,
})
export class SelectDialog {
  protected readonly data = inject<PickData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<SelectDialog, string>>(MatDialogRef);
  protected readonly t = inject(I18n).t;
}

@Injectable({ providedIn: 'root' })
export class Picker {
  private readonly dialog = inject(MatDialog);

  async pick(title: string, options: Option[], selectedId: string | null): Promise<string | null> {
    const ref = this.dialog.open<SelectDialog, PickData, string>(SelectDialog, { data: { title, options, selectedId }, maxWidth: '92vw' });
    return (await firstValueFrom(ref.afterClosed())) ?? null;
  }
}

/** Bordered field that shows the current value and opens the popup list on tap. */
@Component({
  selector: 'app-select-field',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="field" [disabled]="disabled()" (click)="open()" [attr.aria-label]="title()" aria-haspopup="listbox">
      <span class="val" [class.ph]="!selected()">{{ selected()?.label ?? placeholder() }}</span>
      <app-icon name="expandMore" />
    </button>
  `,
  styles: `
    :host{display:block;min-width:0}
    .field{width:100%;min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px;
      border:1px solid var(--line-strong);border-radius:6px;background:var(--surface);font:inherit;color:inherit;cursor:pointer;text-align:left}
    .field:disabled{background:var(--surface-2);cursor:not-allowed;color:var(--muted)}
    .field:hover:not(:disabled),.field:focus-visible{border-color:var(--brand)}
    .val{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ph{color:var(--muted)}
  `,
})
export class SelectField {
  readonly options = input.required<Option[]>();
  readonly value = model<string | null>(null);
  readonly title = input('');
  readonly placeholder = input('Select…');
  readonly disabled = input(false);
  private readonly picker = inject(Picker);
  protected readonly selected = computed(() => this.options().find((o) => o.id === this.value()) ?? null);

  protected async open(): Promise<void> {
    const id = await this.picker.pick(this.title() || this.placeholder(), this.options(), this.value());
    if (id !== null) this.value.set(id);
  }
}

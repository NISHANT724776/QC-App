import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { I18n } from '../core/i18n/i18n';

export interface ConfirmData {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  hideCancel?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data.title) {
      <h2 mat-dialog-title>{{ data.title }}</h2>
    }
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (!data.hideCancel) {
        <button class="btn btn-text" [mat-dialog-close]="false">{{ data.cancelLabel ?? t('Common_Cancel') }}</button>
      }
      <button class="btn" [class.btn-danger]="data.danger" [class.btn-primary]="!data.danger" [mat-dialog-close]="true" cdkFocusInitial>
        {{ data.confirmLabel ?? t('Common_Confirm') }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmData>(MAT_DIALOG_DATA);
  protected readonly t = inject(I18n).t;
}

@Injectable({ providedIn: 'root' })
export class Confirm {
  private readonly dialog = inject(MatDialog);

  async ask(message: string, opts: Omit<ConfirmData, 'message'> = {}): Promise<boolean> {
    const ref = this.dialog.open<ConfirmDialog, ConfirmData, boolean>(ConfirmDialog, {
      data: { message, ...opts },
      maxWidth: '92vw',
      width: '420px',
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}

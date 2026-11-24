import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { MatCalendar, MatCalendarCellClassFunction } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { I18n } from '../core/i18n/i18n';
import { fromIso, toIso } from './date-utils';

interface CalData {
  selected: string | null;
  /** ISO dates that have requests – shown with a yellow dot like the source app */
  marked: string[];
  allowClear: boolean;
}
export type CalResult = { date: string } | { clear: true } | undefined;

@Component({
  selector: 'app-calendar-dialog',
  imports: [MatCalendar, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-dialog-content class="cal">
      <mat-calendar [selected]="sel()" [startAt]="sel() ?? today" (selectedChange)="sel.set($event)" [dateClass]="dateClass" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (data.allowClear) {
        <button class="btn btn-text" (click)="ref.close({ clear: true })">{{ t('Request_ClearDate') }}</button>
      }
      <button class="btn btn-danger" mat-dialog-close>{{ t('Common_Cancel') }}</button>
      <button class="btn btn-primary" [disabled]="!sel()" (click)="ok()">{{ t('Common_Ok') }}</button>
    </mat-dialog-actions>
  `,
  styles: `.cal{width:min(320px,86vw);padding:0 8px!important}`,
})
export class CalendarDialog {
  protected readonly data = inject<CalData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<CalendarDialog, CalResult>>(MatDialogRef);
  protected readonly t = inject(I18n).t;
  protected readonly today = new Date();
  protected readonly sel = signal<Date | null>(this.data.selected ? fromIso(this.data.selected) : null);
  private readonly marked = new Set(this.data.marked);

  protected readonly dateClass: MatCalendarCellClassFunction<Date> = (d, view) =>
    view === 'month' && this.marked.has(toIso(d)) ? 'has-request' : '';

  protected ok(): void {
    const d = this.sel();
    if (d) this.ref.close({ date: toIso(d) });
  }
}

@Injectable({ providedIn: 'root' })
export class CalendarPicker {
  private readonly dialog = inject(MatDialog);

  async pick(selected: string | null, marked: string[], allowClear = false): Promise<CalResult> {
    const ref = this.dialog.open<CalendarDialog, CalData, CalResult>(CalendarDialog, { data: { selected, marked, allowClear }, maxWidth: '92vw' });
    return firstValueFrom(ref.afterClosed());
  }
}

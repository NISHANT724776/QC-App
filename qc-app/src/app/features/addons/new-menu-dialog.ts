import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { I18n } from '../../core/i18n/i18n';

export type NewChoice = 'sample' | 'inspection';

/** "New" pop-up on the request list (next to Sync): New Sample Evaluation / New Inspection. */
@Component({
  selector: 'app-new-menu-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ t('New_Title') }}</h2>
    <div class="opts">
      <button type="button" class="opt" (click)="pick('sample')">
        <span class="ico purple"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3c-1.7 0-3 1.4-3 3.1 0 1 .5 1.9 1.2 2.5L9 17h6l-1.2-8.4c.7-.6 1.2-1.5 1.2-2.5C15 4.4 13.7 3 12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 21h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
        <span class="tx"><b>{{ t('Addons_NewSample') }}</b><small>{{ t('Addons_NewSampleDesc') }}</small></span>
        <span class="go" aria-hidden="true">›</span>
      </button>
      <button type="button" class="opt" (click)="pick('inspection')">
        <span class="ico green"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M8 8h8M8 12h6M8 16h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
        <span class="tx"><b>{{ t('Addons_NewInspection') }}</b><small>{{ t('Addons_NewInspectionDesc') }}</small></span>
        <span class="go" aria-hidden="true">›</span>
      </button>
    </div>
    <div class="foot"><button type="button" class="btn btn-text" mat-dialog-close>{{ t('Common_Cancel') }}</button></div>
  `,
  styles: `
    :host{display:block;min-width:min(420px,88vw)}
    h2{color:var(--brand-dark)}
    .opts{display:grid;gap:12px;padding:4px 20px 8px}
    .opt{display:flex;align-items:center;gap:14px;width:100%;min-height:76px;padding:12px 16px;border:1px solid var(--line);border-radius:14px;background:#fff;font:inherit;text-align:left;cursor:pointer;color:var(--text)}
    .opt:hover,.opt:focus-visible{border-color:var(--brand);background:var(--brand-soft);outline:0}
    .ico{flex:none;width:52px;height:52px;border-radius:14px;display:grid;place-items:center}
    .ico.purple{background:#ede9fe;color:#8b7ff0}.ico.green{background:#e3f9ea;color:#22a45a}
    .tx{flex:1;display:grid;gap:2px}.tx b{font-size:17px;font-weight:600}.tx small{color:var(--muted);font-size:13px}
    .go{font-size:28px;color:var(--brand)}
    .foot{display:flex;justify-content:flex-end;padding:4px 14px 12px}
  `,
})
export class NewMenuDialog {
  private readonly ref = inject<MatDialogRef<NewMenuDialog, NewChoice>>(MatDialogRef);
  protected readonly t = inject(I18n).t;
  protected pick(c: NewChoice): void {
    this.ref.close(c);
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { environment } from '../../../environments/environment';
import { I18n } from '../../core/i18n/i18n';
import { Toast } from '../../core/ui/toast';

interface NavigatorExt extends Navigator {
  deviceMemory?: number;
  connection?: { effectiveType?: string; type?: string; downlink?: number };
}

const mb = (n: number | undefined) => (n === undefined ? '–' : `${(n / 1048576).toFixed(0)} MB`);

function collect(): [string, string][] {
  const n = navigator as NavigatorExt;
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return [
    ['Profile_AppVersion', environment.appVersion],
    ['Profile_Platform', n.platform || '–'],
    ['Profile_OSVersion', n.userAgent],
    ['Profile_DeviceName', `${n.language} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`],
    ['Profile_Manufacturer', n.onLine ? 'Yes' : 'No'],
    ['Profile_Model', `${screen.width}×${screen.height} @${window.devicePixelRatio}x`],
    ['Profile_CpuArchitecture', String(n.hardwareConcurrency ?? '–')],
    ['Profile_TotalRam', n.deviceMemory ? `${n.deviceMemory} GB` : '–'],
    ['Profile_AvailableRam', mb(mem?.usedJSHeapSize)],
    ['Profile_NetworkType', n.connection?.effectiveType ?? n.connection?.type ?? '–'],
    ['Profile_InternetSpeed', n.connection?.downlink ? `${n.connection.downlink} Mbps` : '–'],
  ];
}

/** System diagnostics overlay (D2) – browser equivalents of the device fields in the source app. */
@Component({
  selector: 'app-diagnostics-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ t('Profile_ShowSystemDiagnostics') }}</h2>
    <mat-dialog-content>
      <dl>
        @for (r of rows(); track r[0]) {
          <dt>{{ t(r[0]) }}</dt>
          <dd>{{ r[1] }}</dd>
        }
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button class="btn btn-primary" mat-dialog-close>{{ t('Common_Close') }}</button></mat-dialog-actions>
  `,
  styles: `
    dl{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;margin:0;font-size:13px}
    dt{color:var(--muted)}dd{margin:0;word-break:break-word}
  `,
})
export class DiagnosticsDialog {
  protected readonly t = inject(I18n).t;
  protected readonly rows = signal<[string, string][]>(collect());

  constructor() {
    // storage numbers are async
    void navigator.storage?.estimate?.().then((e) =>
      this.rows.update((r) => [...r, ['Profile_TotalStorage', mb(e.quota)], ['Profile_FreeStorage', mb(e.usage)]]),
    );
  }
}

/** Report a bug (D3). Destination is undocumented (docs Q-20) – the report is copied for pasting. */
@Component({
  selector: 'app-bug-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ t('Profile_ReportABug') }}</h2>
    <mat-dialog-content>
      <textarea class="textarea" [placeholder]="t('Profile_BugPlaceholder')" [value]="text()" (input)="text.set($any($event.target).value)" aria-label="Bug description"></textarea>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button class="btn btn-text" mat-dialog-close>{{ t('Common_Close') }}</button>
      <button class="btn btn-primary" (click)="copy()">{{ t('Profile_BugCopy') }}</button>
    </mat-dialog-actions>
  `,
})
export class BugReportDialog {
  protected readonly t = inject(I18n).t;
  private readonly toast = inject(Toast);
  protected readonly text = signal('');

  protected async copy(): Promise<void> {
    const body = `${this.text()}\n\n--- diagnostics ---\n${collect().map(([k, v]) => `${k}: ${v}`).join('\n')}`;
    try {
      await navigator.clipboard.writeText(body);
      this.toast.success(this.t('Profile_BugCopied'));
    } catch {
      this.toast.error('Copy failed');
    }
  }
}

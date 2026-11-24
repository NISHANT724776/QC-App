import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { I18n } from '../../core/i18n/i18n';
import { RequestsStore } from '../../core/sync/requests-store';
import { Sync } from '../../core/sync/sync';
import { Toast } from '../../core/ui/toast';
import { InspectionRepository } from '../../data/repositories';
import { Icon } from '../../shared/icon';
import { TopBar } from '../../shared/top-bar';

/* ------------------------------------------------------------------ Share / download sheet (requirements doc, Triton item 5) */
interface ShareData {
  blob: Blob;
  fileName: string;
  canShareFiles: boolean;
}

@Component({
  selector: 'app-share-sheet',
  imports: [MatDialogModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="file"><span class="pdf">PDF</span><div><b>{{ data.fileName }}</b><span>PDF Document · {{ size }}</span></div></div>
    <div class="apps">
      @if (data.canShareFiles) {
        <button type="button" (click)="act('native')"><span class="ic" style="background:#3b9bf0"><app-icon name="arrowForward" [size]="24" /></span>{{ t('Share_Device') }}</button>
      }
      <button type="button" (click)="act('whatsapp')"><span class="ic" style="background:#25b34f">💬</span>WhatsApp</button>
      <button type="button" (click)="act('mail')"><span class="ic" style="background:#2f7de1"><app-icon name="mail" [size]="24" /></span>Mail</button>
      <button type="button" (click)="act('sms')"><span class="ic" style="background:#34c759">🗨</span>Messages</button>
    </div>
    <div class="list">
      <button type="button" (click)="act('download')">{{ t('Share_SaveFiles') }} <span>⤓</span></button>
      <button type="button" (click)="act('copy')">{{ t('Share_Copy') }} <span>⧉</span></button>
      <button type="button" (click)="act('print')">{{ t('Share_Print') }} <span>⎙</span></button>
    </div>
    <p class="hint">{{ t('Share_Hint') }}</p>
    <div class="foot"><button class="btn btn-text" mat-dialog-close>{{ t('Common_Cancel') }}</button></div>
  `,
  styles: `
    :host{display:block;min-width:min(420px,86vw);padding:8px 4px}
    .file{display:flex;gap:12px;align-items:center;padding:8px 12px 14px;border-bottom:1px solid var(--line)}
    .file span.pdf{display:grid;place-items:center;width:44px;height:52px;border-radius:6px;background:#fff;border:1px solid var(--line);color:#d93f3f;font-weight:800;font-size:12px}
    .file div{display:grid;font-size:14px}.file div span{color:var(--muted);font-size:12px}
    .apps{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;padding:16px 8px}
    .apps button{display:grid;justify-items:center;gap:6px;width:84px;border:0;background:none;font:inherit;font-size:12px;cursor:pointer;color:var(--text)}
    .ic{display:grid;place-items:center;width:54px;height:54px;border-radius:14px;color:#fff;font-size:24px}
    .list{margin:0 8px;border:1px solid var(--line);border-radius:10px;overflow:hidden}
    .list button{display:flex;justify-content:space-between;align-items:center;width:100%;min-height:48px;padding:0 16px;border:0;border-bottom:1px solid var(--line);background:#fff;font:inherit;cursor:pointer}
    .list button:last-child{border-bottom:0}.list button:hover{background:var(--brand-soft)}
    .hint{margin:10px 14px 0;font-size:12px;color:var(--muted)}.foot{display:flex;justify-content:flex-end;padding:6px}
  `,
})
export class ShareSheet {
  protected readonly data = inject<ShareData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ShareSheet, string>>(MatDialogRef);
  protected readonly t = inject(I18n).t;
  protected readonly size = `${Math.max(1, Math.round(this.data.blob.size / 1024))} KB`;
  protected act(a: string): void {
    this.ref.close(a);
  }
}

/** Report viewer (B6): PDF view, Back, Send as email. The report exists on the server after Sync. */
@Component({
  selector: 'app-report-viewer',
  imports: [TopBar, Icon, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-top-bar [title]="t('ReportView_Title')" [back]="true" (backClick)="back()" />
    <main class="wrap">
      <div class="actions">
        <button class="btn btn-outline" (click)="back()"><app-icon name="back" /> {{ t('Common_Back') }}</button>
        @if (url()) {
          <span class="grow"></span>
          <a class="btn btn-outline" [href]="url()" target="_blank" rel="noopener"><app-icon name="pdf" /> {{ t('ReportView_Open') }}</a>
          <button class="btn btn-primary" (click)="email()" [disabled]="sending()"><app-icon name="mail" /> {{ t('ReportView_SendEmail') }}</button>
        }
      </div>
      @if (loading()) {
        <p class="msg" role="status">{{ t('ReportView_Generating') }}</p>
      } @else if (needsSync()) {
        <div class="card msg">
          <app-icon name="info" [size]="28" />
          <p>{{ t('Request_SyncPending') }}</p>
          <button class="btn btn-primary" (click)="syncThenLoad()" [disabled]="sync.syncing()"><app-icon name="sync" /> {{ t('Request_Sync') }}</button>
        </div>
      } @else if (url()) {
        <iframe class="pdf" [src]="url()!" title="Inspection report"></iframe>
      }
    </main>
    @if (url()) {
      <div class="shbar">
        <button class="btn btn-outline" (click)="download()"><span aria-hidden="true">⤓</span> {{ t('Share_Download') }}</button>
        <button class="btn btn-primary" (click)="share()"><app-icon name="arrowForward" [size]="20" /> {{ t('Share_Share') }}</button>
      </div>
    }
  `,
  styles: `
    :host{display:flex;flex-direction:column;min-height:100vh;background:var(--surface)}
    .wrap{flex:1;display:flex;flex-direction:column;padding:12px 16px;gap:12px;max-width:1100px;width:100%;margin:0 auto}
    .actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
    .grow{flex:1}
    .pdf{flex:1;min-height:70vh;width:100%;border:1px solid var(--line);border-radius:8px;background:#fff}
    .shbar{position:sticky;bottom:0;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid var(--line)}
    .msg{display:grid;justify-items:center;gap:8px;padding:32px;text-align:center;color:var(--muted)}
  `,
})
export class ReportViewerPage implements OnInit, OnDestroy {
  readonly requestId = input.required<string>();
  readonly orderId = input.required<string>();

  private readonly repo = inject(InspectionRepository);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);
  private readonly store = inject(RequestsStore);
  protected readonly sync = inject(Sync);
  protected readonly t = inject(I18n).t;

  protected readonly url = signal<SafeResourceUrl | null>(null);
  protected readonly loading = signal(true);
  protected readonly needsSync = signal(false);
  protected readonly sending = signal(false);
  private objectUrl: string | null = null;
  private blob: Blob | null = null;
  private readonly dialog = inject(MatDialog);

  async ngOnInit(): Promise<void> {
    await this.store.ensureLoaded();
    await this.load();
  }

  ngOnDestroy(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    const order = this.store.find(this.requestId())?.orders.find((o) => o.qaRequestOrderId === this.orderId());
    if (order && order.syncState === 'pending') {
      this.needsSync.set(true);
      this.loading.set(false);
      return;
    }
    this.needsSync.set(false);
    try {
      const blob = await this.repo.fetchReport(this.requestId(), this.orderId());
      this.blob = blob;
      this.objectUrl = URL.createObjectURL(blob);
      this.url.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
    } catch {
      this.toast.error(this.t('Msg_NoInternetConnection'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async syncThenLoad(): Promise<void> {
    try {
      await this.sync.run();
      await this.load();
    } catch {
      this.toast.error(this.t('Msg_NoInternetConnection'));
    }
  }

  protected async email(): Promise<void> {
    this.sending.set(true);
    try {
      await this.repo.sendReportEmail(this.requestId(), this.orderId());
      this.toast.success(this.t('ReportView_SentAsEmail'));
    } catch {
      this.toast.error(this.t('Msg_NoInternetConnection'));
    } finally {
      this.sending.set(false);
    }
  }

  private get fileName(): string {
    const tran = this.store.find(this.requestId())?.tranNum ?? this.requestId();
    return `Final Inspection Report ${tran}.pdf`;
  }

  /** Download the report PDF (Share & Download options – requirements doc item 5). */
  protected download(): void {
    if (!this.objectUrl) return;
    const a = document.createElement('a');
    a.href = this.objectUrl;
    a.download = this.fileName;
    a.click();
    this.toast.success(this.t('Share_Downloaded', { name: this.fileName }));
  }

  /** Share sheet: device share (Web Share API with the PDF file), WhatsApp, Mail, Messages, Save, Copy, Print. */
  protected async share(): Promise<void> {
    if (!this.blob) return;
    const file = new File([this.blob], this.fileName, { type: 'application/pdf' });
    const canShareFiles = !!navigator.canShare?.({ files: [file] });
    const ref = this.dialog.open<ShareSheet, ShareData, string>(ShareSheet, {
      data: { blob: this.blob, fileName: this.fileName, canShareFiles }, maxWidth: '94vw', panelClass: 'addon-dialog', autoFocus: false,
    });
    const choice = await firstValueFrom(ref.afterClosed());
    const text = this.fileName;
    switch (choice) {
      case 'native':
        try {
          await navigator.share({ files: [file], title: this.fileName, text });
        } catch {
          /* user cancelled the device share sheet */
        }
        break;
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        this.toast.info(this.t('Share_AttachHint'));
        break;
      case 'mail':
        location.href = `mailto:?subject=${encodeURIComponent(this.fileName)}&body=${encodeURIComponent(this.t('Share_MailBody', { name: this.fileName }))}`;
        this.toast.info(this.t('Share_AttachHint'));
        break;
      case 'sms':
        location.href = `sms:?body=${encodeURIComponent(text)}`;
        break;
      case 'download':
        this.download();
        break;
      case 'copy':
        try {
          await navigator.clipboard.writeText(text);
          this.toast.success(this.t('Share_Copied'));
        } catch {
          this.toast.error(this.t('Share_CopyFailed'));
        }
        break;
      case 'print':
        this.print();
        break;
    }
  }

  private print(): void {
    const frame = document.querySelector<HTMLIFrameElement>('iframe.pdf');
    try {
      frame?.contentWindow?.focus();
      frame?.contentWindow?.print();
    } catch {
      window.open(this.objectUrl ?? '', '_blank', 'noopener');
    }
  }

  protected back(): void {
    void this.router.navigate(['/requests']);
  }
}

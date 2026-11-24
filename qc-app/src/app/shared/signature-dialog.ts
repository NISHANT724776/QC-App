import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import type SignaturePad from 'signature_pad';
import { I18n } from '../core/i18n/i18n';

/** Full-screen friendly signature pad (library lazy-loaded when the dialog opens). */
@Component({
  selector: 'app-signature-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <div class="pad"><canvas #canvas aria-label="Signature area"></canvas></div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button class="btn btn-text" (click)="clear()">{{ t('FinalResult_Clear') }}</button>
      <button class="btn btn-danger" mat-dialog-close>{{ t('Common_Cancel') }}</button>
      <button class="btn btn-primary" [disabled]="empty()" (click)="ok()">{{ t('FinalResult_Ok') }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .pad{width:min(560px,82vw);height:min(260px,40vh);border:1px solid var(--line-strong);border-radius:8px;background:#fff;touch-action:none}
    canvas{width:100%;height:100%;display:block}
  `,
})
export class SignatureDialog implements AfterViewInit, OnDestroy {
  protected readonly data = inject<{ title: string; existing: string | null }>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<SignatureDialog, string>>(MatDialogRef);
  protected readonly t = inject(I18n).t;
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  protected readonly empty = signal(true);
  private pad?: SignaturePad;

  async ngAfterViewInit(): Promise<void> {
    const { default: Pad } = await import('signature_pad');
    const el = this.canvas().nativeElement;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    el.width = el.offsetWidth * ratio;
    el.height = el.offsetHeight * ratio;
    el.getContext('2d')!.scale(ratio, ratio);
    this.pad = new Pad(el, { penColor: '#111' });
    this.pad.addEventListener('endStroke', () => this.empty.set(this.pad!.isEmpty()));
    if (this.data.existing) {
      await this.pad.fromDataURL(this.data.existing, { ratio: 1, width: el.offsetWidth, height: el.offsetHeight });
      this.empty.set(this.pad.isEmpty());
    }
  }

  ngOnDestroy(): void {
    this.pad?.off();
  }

  protected clear(): void {
    this.pad?.clear();
    this.empty.set(true);
  }

  protected ok(): void {
    if (this.pad && !this.pad.isEmpty()) this.ref.close(this.pad.toDataURL('image/png'));
  }
}

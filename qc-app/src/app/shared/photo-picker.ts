import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { I18n } from '../core/i18n/i18n';
import { Settings } from '../core/settings/settings';
import { PhotoAttachment } from '../domain/models/inspection';
import { Icon } from './icon';
import { fileToPhoto } from './image';

/** "Add Attachment" sheet: From Gallery / Take Photo (camera capture on devices that support it). */
@Component({
  selector: 'app-photo-source-dialog',
  imports: [MatDialogModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ t('Common_AddAttachment') }}</h2>
    <mat-dialog-content class="sources">
      <button class="source" (click)="gallery.click()">
        <app-icon name="image" [size]="40" />
        <span>{{ t('Common_FromGallery') }}</span>
      </button>
      <button class="source" (click)="camera.click()">
        <app-icon name="camera" [size]="40" />
        <span>{{ t('Common_TakePhoto') }}</span>
      </button>
      <input #gallery type="file" accept="image/*" multiple hidden (change)="done($event)" />
      <input #camera type="file" accept="image/*" capture="environment" hidden (change)="done($event)" />
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button class="btn btn-text" mat-dialog-close>{{ t('Common_Cancel') }}</button></mat-dialog-actions>
  `,
  styles: `
    .sources{display:grid;gap:12px;min-width:min(300px,80vw)}
    .source{display:flex;flex-direction:column;align-items:center;gap:8px;padding:24px;border:1px solid var(--line);
      border-radius:8px;background:#fff;color:var(--brand);font-size:16px;cursor:pointer;min-height:44px}
    .source:hover,.source:focus-visible{background:var(--brand-soft)}
  `,
})
export class PhotoSourceDialog {
  protected readonly t = inject(I18n).t;
  private readonly ref = inject<MatDialogRef<PhotoSourceDialog, File[]>>(MatDialogRef);

  protected done(e: Event): void {
    const files = Array.from((e.target as HTMLInputElement).files ?? []);
    this.ref.close(files);
  }
}

@Injectable({ providedIn: 'root' })
export class PhotoPicker {
  private readonly dialog = inject(MatDialog);
  private readonly settings = inject(Settings);

  /** Resolves with the new attachments (empty when cancelled). */
  async pick(): Promise<PhotoAttachment[]> {
    const ref = this.dialog.open<PhotoSourceDialog, void, File[]>(PhotoSourceDialog, { maxWidth: '92vw' });
    const files = (await firstValueFrom(ref.afterClosed())) ?? [];
    const optimize = this.settings.value().optimizeImage;
    return Promise.all(files.map((f) => fileToPhoto(f, optimize)));
  }
}

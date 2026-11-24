import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { I18n } from '../../../core/i18n/i18n';
import { PhotoAttachment } from '../../../domain/models/inspection';
import { PhotoPicker } from '../../../shared/photo-picker';
import { PhotoStrip } from '../../../shared/photo-strip';

export interface DefectPhotosData {
  title: string;
  photos: PhotoAttachment[];
  readonly: boolean;
}

/** Per-defect attachment dialog: title, Upload (gallery/camera), thumbnails with comment + delete, Save/Cancel. */
@Component({
  selector: 'app-defect-photos-dialog',
  imports: [MatDialogModule, PhotoStrip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content class="content">
      <app-photo-strip [photos]="photos()" [readonly]="data.readonly" [comments]="true" (add)="upload()" (remove)="remove($event)" (commentChange)="comment($event)" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (!data.readonly) {
        <button class="btn btn-outline" (click)="upload()">{{ t('Defect_Upload') }}</button>
        <button class="btn btn-primary" (click)="ref.close(photos())">{{ t('Common_Save') }}</button>
      }
      <button class="btn btn-danger" mat-dialog-close>{{ data.readonly ? t('Common_Close') : t('Common_Cancel') }}</button>
    </mat-dialog-actions>
  `,
  styles: `.content{min-width:min(520px,80vw);min-height:180px}`,
})
export class DefectPhotosDialog {
  protected readonly data = inject<DefectPhotosData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<DefectPhotosDialog, PhotoAttachment[]>>(MatDialogRef);
  protected readonly t = inject(I18n).t;
  private readonly picker = inject(PhotoPicker);
  protected readonly photos = signal<PhotoAttachment[]>(structuredClone(this.data.photos));

  protected async upload(): Promise<void> {
    const added = await this.picker.pick();
    if (added.length) this.photos.update((p) => [...p, ...added]);
  }
  protected remove(id: string): void {
    this.photos.update((p) => p.filter((x) => x.id !== id));
  }
  protected comment(e: { id: string; comment: string }): void {
    this.photos.update((p) => p.map((x) => (x.id === e.id ? { ...x, comment: e.comment } : x)));
  }
}

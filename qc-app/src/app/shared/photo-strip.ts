import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { I18n } from '../core/i18n/i18n';
import { PhotoAttachment } from '../domain/models/inspection';
import { Icon } from './icon';

@Component({
  selector: 'app-image-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<img [src]="data.src" alt="" style="max-width:100%;max-height:80vh;display:block;margin:auto" />
    <mat-dialog-actions align="end"><button class="btn btn-text" mat-dialog-close>Close</button></mat-dialog-actions>`,
})
export class ImageDialog {
  protected readonly data = inject<{ src: string }>(MAT_DIALOG_DATA);
}

/** Horizontal strip of photo thumbnails with "+" tile, remove badge and optional per-photo comment. */
@Component({
  selector: 'app-photo-strip',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="strip">
      @if (!readonly()) {
        <button type="button" class="add" (click)="add.emit()" [attr.aria-label]="t('Common_AddAttachment')">
          <app-icon name="add" [size]="28" />
        </button>
      }
      @for (p of photos(); track p.id) {
        <div class="thumb">
          <div class="frame">
            <img [src]="p.dataUrl" [alt]="p.name" loading="lazy" (click)="open(p)" [title]="p.name" />
            @if (!readonly()) {
              <button type="button" class="del" (click)="remove.emit(p.id)" [attr.aria-label]="t('Common_Delete')">
                <app-icon name="remove" [size]="14" />
              </button>
            }
            @if (!p.uploaded) {
              <span class="queued" title="Queued for upload"></span>
            }
          </div>
          <span class="cap">{{ p.name }}</span>
          @if (comments()) {
            <input
              class="input"
              [value]="p.comment"
              [placeholder]="t('Defect_PhotoComment')"
              [readOnly]="readonly()"
              (input)="commentChange.emit({ id: p.id, comment: $any($event.target).value })"
            />
          }
        </div>
      }
    </div>
  `,
  styles: `
    .strip{display:flex;gap:12px;overflow-x:auto;padding:8px 4px;align-items:flex-start}
    .add{flex:none;width:72px;height:88px;border:1px dashed var(--line-strong);border-radius:8px;background:#fff;color:var(--muted);cursor:pointer}
    .add:hover,.add:focus-visible{border-color:var(--brand);color:var(--brand)}
    .thumb{flex:none;width:120px;display:grid;gap:6px}
    .frame{position:relative;width:120px;height:100px;border:1px solid var(--line);border-radius:8px;background:#fff;display:grid;place-items:center}
    img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;cursor:zoom-in}
    .del{position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:50%;border:0;background:var(--danger);color:#fff;display:grid;place-items:center;cursor:pointer}
    .queued{position:absolute;left:6px;bottom:6px;width:10px;height:10px;border-radius:50%;background:var(--warn)}
    .input{width:100%;height:36px}
    .cap{font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center}
  `,
})
export class PhotoStrip {
  readonly photos = input.required<PhotoAttachment[]>();
  readonly readonly = input(false);
  readonly comments = input(false);
  readonly add = output<void>();
  readonly remove = output<string>();
  readonly commentChange = output<{ id: string; comment: string }>();
  /** false = clicking a photo emits `photoOpen` (used to open the single-screen rename) instead of the zoom preview */
  readonly previewOnClick = input(true);
  readonly photoOpen = output<string>();
  protected readonly t = inject(I18n).t;
  private readonly dialog = inject(MatDialog);

  protected open(p: PhotoAttachment): void {
    if (this.previewOnClick()) this.dialog.open(ImageDialog, { data: { src: p.dataUrl }, maxWidth: '92vw' });
    else this.photoOpen.emit(p.id);
  }
}

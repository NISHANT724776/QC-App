import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { I18n } from '../../core/i18n/i18n';
import { Toast } from '../../core/ui/toast';
import { PhotoAttachment } from '../../domain/models/inspection';
import { Icon } from '../../shared/icon';
import { InspectionStore } from './inspection-store';

export interface RenameRow {
  photo: PhotoAttachment;
  /** small hint under the name field (e.g. the defect the photo belongs to) */
  note: string;
}
export interface RenameGroup {
  title: string;
  rows: RenameRow[];
}
export interface RenameData {
  title: string;
  groups: RenameGroup[];
}

/**
 * Rename photos on a single screen (requirements doc – Triton item 4): tapping any photo of a tab opens this list of
 * ALL photos of that tab, grouped like the tab, with an editable Name column. One Save applies every name.
 */
@Component({
  selector: 'app-photo-rename-dialog',
  imports: [MatDialogModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg-head"><h2><app-icon name="image" [size]="22" /> {{ data.title }}</h2><div class="acts"><button (click)="ref.close()" [attr.aria-label]="t('Common_Close')">✕</button></div></div>
    <div class="dlg-body">
      <table class="rn">
        <thead><tr><th>{{ t('Rename_Image') }}</th><th>{{ t('Rename_Name') }}</th></tr></thead>
        <tbody>
          @for (g of data.groups; track g.title; let gi = $index) {
            <tr class="g" (click)="toggle(gi)" tabindex="0" (keydown.enter)="toggle(gi)" [attr.aria-expanded]="!collapsed().has(gi)">
              <td colspan="2"><app-icon [name]="collapsed().has(gi) ? 'chevronRight' : 'expandMore'" [size]="20" /> {{ g.title }} ({{ g.rows.length }})</td>
            </tr>
            @if (!collapsed().has(gi)) {
              @for (r of g.rows; track r.photo.id) {
                <tr>
                  <td class="im"><img [src]="r.photo.dataUrl" [alt]="r.photo.name" /></td>
                  <td>
                    <input class="input" [value]="names()[r.photo.id] ?? r.photo.name" [placeholder]="t('Rename_Enter')" (input)="set(r.photo.id, $any($event.target).value)" [attr.aria-label]="t('Rename_Name') + ' – ' + r.photo.name" />
                    @if (r.note) {<small>{{ r.note }}</small>}
                  </td>
                </tr>
              }
            }
          }
        </tbody>
      </table>
    </div>
    <div class="dlg-foot">
      <button class="btn btn-outline" (click)="ref.close()">{{ t('Common_Cancel') }}</button>
      <button class="btn btn-primary" (click)="ref.close(names())">{{ t('Common_Save') }}</button>
    </div>
  `,
  styles: `
    .dlg-head h2 app-icon{vertical-align:-4px;margin-right:6px}
    .rn{width:100%;border-collapse:collapse}
    .rn thead th{background:#3dbccb;color:#fff;padding:10px;text-align:center;position:sticky;top:0;z-index:1}
    .rn td{padding:6px 10px;border-bottom:1px solid var(--line);vertical-align:middle}
    .rn .g td{background:#eaf6f7;font-weight:700;color:#14505a;cursor:pointer}
    .im{width:150px;text-align:center}.im img{width:96px;height:72px;object-fit:cover;border:1px solid var(--line);border-radius:6px;background:#fff}
    small{display:block;color:var(--muted);font-size:12px;margin-top:2px}
  `,
})
export class PhotoRenameDialog {
  protected readonly data = inject<RenameData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<PhotoRenameDialog, Record<string, string>>>(MatDialogRef);
  protected readonly t = inject(I18n).t;
  protected readonly names = signal<Record<string, string>>({});
  protected readonly collapsed = signal<ReadonlySet<number>>(new Set());

  protected set(id: string, v: string): void {
    this.names.update((n) => ({ ...n, [id]: v }));
  }
  protected toggle(gi: number): void {
    this.collapsed.update((s) => {
      const n = new Set(s);
      if (n.has(gi)) n.delete(gi);
      else n.add(gi);
      return n;
    });
  }
}

@Injectable({ providedIn: 'root' })
export class PhotoRenamer {
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(Toast);
  private readonly t = inject(I18n).t;

  /** Open the single-screen rename for every photo of the section; applies the names to the store on Save. */
  async open(store: InspectionStore, sectionKey: string): Promise<void> {
    const groups = store.photoGroups(sectionKey);
    if (!groups.some((g) => g.rows.length)) {
      this.toast.info(this.t('Rename_None'));
      return;
    }
    const title = store.sectionOf(sectionKey)?.label ?? '';
    const ref = this.dialog.open<PhotoRenameDialog, RenameData, Record<string, string>>(PhotoRenameDialog, {
      data: { title, groups: groups.filter((g) => g.rows.length) }, width: '760px', maxWidth: '96vw', panelClass: 'addon-dialog', autoFocus: false,
    });
    const names = await firstValueFrom(ref.afterClosed());
    if (!names) return;
    const n = store.renamePhotos(sectionKey, names);
    this.toast[n ? 'success' : 'info'](n ? this.t('Rename_Saved', { n }) : this.t('Rename_NoChanges'));
  }
}

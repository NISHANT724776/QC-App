import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { I18n } from '../../../core/i18n/i18n';
import { PhotoPicker } from '../../../shared/photo-picker';
import { PhotoStrip } from '../../../shared/photo-strip';
import { Icon } from '../../../shared/icon';
import { InspectionStore } from '../inspection-store';
import { PhotoRenamer } from '../photo-rename';

const KEY = 'ra-sheet';

/**
 * RA Sheet (C2): Activity / Risk / Action Required are server data (read-only, tap to expand);
 * the QC enters Comments and may attach files per activity (icon highlights when attachments exist).
 */
@Component({
  selector: 'app-ra-sheet-section',
  imports: [Icon, PhotoStrip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.form(); as f) {
      <div class="rows" role="table" [attr.aria-label]="t('Section_RaSheet')">
        <div class="tr th" role="row">
          <span role="columnheader">{{ t('RASheet_Activity') }}</span>
          <span role="columnheader">{{ t('RASheet_Risk') }}</span>
          <span role="columnheader">{{ t('RASheet_ActionRequired') }}</span>
          <span role="columnheader" class="c"><span class="sr-only">{{ t('RASheet_Attachments') }}</span></span>
          <span role="columnheader">{{ t('Common_Comments') }}</span>
        </div>
        @for (r of f.ra; track r.id) {
          <div class="tr" role="row">
            <span role="cell" class="act">{{ r.activity }}</span>
            <span role="cell"><button type="button" class="txt" [class.open]="open().has(r.id + 'r')" (click)="toggle(r.id + 'r')" [attr.aria-expanded]="open().has(r.id + 'r')">{{ shown(r.risk) }}</button></span>
            <span role="cell"><button type="button" class="txt" [class.open]="open().has(r.id + 'a')" (click)="toggle(r.id + 'a')" [attr.aria-expanded]="open().has(r.id + 'a')">{{ shown(r.actionRequired) }}</button></span>
            <span role="cell" class="c">
              <button type="button" class="att" [class.has]="r.attachments.length" (click)="toggle(r.id + 'p')" [attr.aria-label]="t('RASheet_Attachments') + ' (' + r.attachments.length + ')'" [attr.aria-expanded]="open().has(r.id + 'p')">
                <app-icon name="link" [size]="22" />@if (r.attachments.length) {<span class="n">{{ r.attachments.length }}</span>}
              </button>
            </span>
            <span role="cell"><input class="input" [value]="r.comments" [disabled]="store.locked()" [attr.aria-label]="t('Common_Comments') + ' ' + r.activity" (input)="comment(r.id, $any($event.target).value)" /></span>
            @if (open().has(r.id + 'p')) {
              <div class="photos">
                <app-photo-strip [previewOnClick]="false" (photoOpen)="rename()" [photos]="r.attachments" [readonly]="store.locked()" (add)="addPhotos(r.id)" (remove)="removePhoto(r.id, $event)" />
              </div>
            }
          </div>
        }
      </div>
    }
  `,
  styles: `
    .rows{display:grid}
      .tr{display:grid;grid-template-columns:110px minmax(0,1fr) minmax(0,1fr) 44px minmax(110px,1fr);gap:12px;align-items:center;padding:6px 4px;border-bottom:1px solid var(--line);min-height:56px}
    .th{font-weight:600;font-size:16px;min-height:44px;border-bottom:1px solid var(--line)}
    .act{color:#4a575d}.c{text-align:center}
    .txt{min-width:0;border:0;background:none;text-align:left;font:inherit;color:#6a757b;cursor:pointer;padding:8px 0;min-height:44px;display:block;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .txt.open{white-space:normal}
    .att{position:relative;width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:#9aa5ab;cursor:pointer;display:inline-grid;place-items:center}
    .att.has{color:var(--brand)}.att:hover{background:var(--brand-soft)}
    .n{position:absolute;top:2px;right:0;font-size:11px;background:var(--brand-dark);color:#fff;border-radius:999px;min-width:16px;height:16px;display:grid;place-items:center}
    .photos{grid-column:1/-1}
    @media (max-width:760px){
      .tr{grid-template-columns:78px minmax(0,1fr) minmax(0,1fr) 40px minmax(90px,1fr);gap:6px}
      .txt{font-size:12px}
    }
  `,
})
export class RaSheetSection implements OnInit {
  protected readonly store = inject(InspectionStore);
  protected readonly t = inject(I18n).t;
  private readonly picker = inject(PhotoPicker);
  private readonly renamer = inject(PhotoRenamer);
  protected readonly open = signal<ReadonlySet<string>>(new Set());

  ngOnInit(): void {
    this.store.activeSection.set(KEY);
  }

  /** Shown exactly as delivered by the server (empty cells are blank or ".", as in the source screenshots). */
  protected shown(v: string): string {
    return v ?? '';
  }

  protected rename(): void {
    void this.renamer.open(this.store, KEY);
  }

  protected toggle(k: string): void {
    this.open.update((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  protected comment(id: string, v: string): void {
    this.store.update(KEY, 'ra', (rows) => rows.map((r) => (r.id === id ? { ...r, comments: v } : r)));
  }

  protected async addPhotos(id: string): Promise<void> {
    const photos = await this.picker.pick();
    if (photos.length) this.store.update(KEY, 'ra', (rows) => rows.map((r) => (r.id === id ? { ...r, attachments: [...r.attachments, ...photos] } : r)));
  }

  protected removePhoto(id: string, photoId: string): void {
    this.store.update(KEY, 'ra', (rows) => rows.map((r) => (r.id === id ? { ...r, attachments: r.attachments.filter((p) => p.id !== photoId) } : r)));
  }
}

import { ChangeDetectionStrategy, Component, Injectable, OnInit, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { I18n } from '../../../core/i18n/i18n';
import { Toast } from '../../../core/ui/toast';
import { DefectGroup, DefectItem, PhotoAttachment } from '../../../domain/models/inspection';
import { applyMasterSelection, criticalEditable, deleteSelected, initialSelection, newManualDefect } from '../../../domain/rules/defect-groups.rule';
import { CounterStepper } from '../../../shared/counter-stepper';
import { Icon } from '../../../shared/icon';
import { InspectionStore } from '../inspection-store';
import { PhotoRenamer } from '../photo-rename';
import { DefectPhotosDialog } from './defect-photos-dialog';

const KEY = 'defects';

/* ------------------------------------------------------------------ Select Defects (master list) */
@Component({
  selector: 'app-select-defects-dialog',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dlg-head"><h2>☑ {{ t('Defect_SelectDefectsTitle') }}</h2>
      <div class="acts"><button (click)="ref.close(checked())">{{ t('Common_Confirm') }}</button><button (click)="ref.close()" [attr.aria-label]="t('Common_Close')">✕</button></div></div>
    <p class="note">{{ t('Defect_SelectNote') }}</p>
    <div class="gh"><b>{{ data.group.name }}</b><span>{{ t('Defect_SelectedCount', { a: checked().size, b: data.group.master!.length }) }}</span></div>
    <div class="list">
      @for (m of data.group.master!; track m.name) {
        <label class="item" [class.locked]="m.isDefault">
          <input type="checkbox" [checked]="checked().has(m.name)" [disabled]="m.isDefault" (change)="toggle(m.name, $any($event.target).checked)" />
          <span class="nm">{{ m.name }}</span>
          @if (m.isDefault) {<span class="tag">{{ t('Defect_DefaultTag') }}</span>}
          @if (m.critical) {<span class="tag c">{{ t('Defect_CriticalTag') }}</span>}
        </label>
      }
    </div>
    <div class="dlg-foot">
      <button class="btn btn-outline" (click)="ref.close()">{{ t('Common_Cancel') }}</button>
      <button class="btn btn-primary" (click)="ref.close(checked())">{{ t('Common_Confirm') }}</button>
    </div>
  `,
  styles: `
    .note{margin:0;padding:12px 20px;color:var(--muted);font-size:14px}
    .gh{display:flex;justify-content:space-between;padding:6px 20px;color:#14505a}.gh span{font-size:13px;color:var(--brand-dark)}
    .list{max-height:48vh;overflow:auto;margin:0 16px;border:1px solid var(--line);border-radius:8px}
    .item{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--line);min-height:48px;cursor:pointer}
    .item:last-child{border-bottom:0}.item.locked{color:#8a959b;cursor:default}
    .item input{width:20px;height:20px;accent-color:var(--brand-dark)}
    .nm{flex:1}.tag{font-size:11px;padding:1px 8px;border-radius:999px;background:var(--brand-soft);color:var(--brand-dark)}
    .tag.c{background:var(--danger-soft);color:var(--danger);font-weight:700}
  `,
})
export class SelectDefectsDialog {
  protected readonly data = inject<{ group: DefectGroup }>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<SelectDefectsDialog, ReadonlySet<string>>>(MatDialogRef);
  protected readonly t = inject(I18n).t;
  protected readonly checked = signal<ReadonlySet<string>>(initialSelection(this.data.group));

  protected toggle(name: string, on: boolean): void {
    this.checked.update((s) => {
      const n = new Set(s);
      if (on) n.add(name);
      else n.delete(name);
      return n;
    });
  }
}

/**
 * Defect Capturing (requirements doc, Triton items 1–3):
 *  - every group (incl. the final "Other Defects") has Add / Delete
 *  - master defects flagged Default are shown automatically; the rest are chosen with "Select defects"
 *  - Critical "!" comes from the master for master rows (read-only); manual rows have a clickable Critical column
 * Exceeding the acceptable limit only warns (docs Q-6). Photos open the single-screen rename (item 4).
 */
@Component({
  selector: 'app-defects-section',
  imports: [CounterStepper, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.form(); as f) {
      @let micro = f.defects.config.microEnabled;
      @for (g of f.defects.groups; track g.name) {
        @let open = !collapsed().has(g.name);
        <section class="group">
          <div class="ghead">
            <button type="button" class="gtitle" (click)="toggleGroup(g.name)" [attr.aria-expanded]="open">
              <app-icon [name]="open ? 'expandMore' : 'chevronRight'" [size]="24" />
              <span>{{ g.name }}</span>
              <small>{{ g.items.length }} defect{{ g.items.length === 1 ? '' : 's' }} · {{ t('Defect_Major') }} <b [class.hl]="majorOf(g)">{{ majorOf(g) }}</b> · {{ t('Defect_Minor') }} <b [class.hl]="minorOf(g)">{{ minorOf(g) }}</b></small>
            </button>
            @if (!store.locked()) {
              <div class="gacts">
                <button type="button" class="gbtn add" (click)="add(g.name)"><app-icon name="add" [size]="18" /> Add</button>
                <button type="button" class="gbtn del" (click)="del(g.name)"><app-icon name="delete" [size]="18" /> Delete</button>
              </div>
            }
          </div>
          @if (open) {
            <div class="scroll">
              <div class="grid hdr" [class.micro]="micro" role="row" aria-hidden="true">
                <span>{{ t('Defect_Select') }}</span><span>{{ t('Defect_Critical_Col') }}</span><span class="l">{{ t('Defect_TitleHeader') }}</span><span>{{ t('Defect_Remarks') }}</span><span>{{ t('Defect_Major') }}</span><span>{{ t('Defect_Minor') }}</span>
                @if (micro) {<span>{{ t('Defect_Micro') }}</span>}
                <span>{{ t('Defect_Action') }}</span>
              </div>
              @for (d of g.items; track d.id) {
                <div class="grid row" [class.micro]="micro" [class.critrow]="d.critical" role="row">
                  <span class="c"><input type="checkbox" [checked]="!!d.selected" [disabled]="d.isDefault || store.locked()" [attr.title]="d.isDefault ? 'Default defect (locked)' : null"
                    (change)="patch(g.name, d.id, { selected: $any($event.target).checked })" [attr.aria-label]="'Select ' + (d.name || 'new defect')" /></span>
                  <span class="c">
                    <button type="button" class="critslot" [class.on]="d.critical" [disabled]="store.locked()" [title]="t('Defect_CriticalToggle')" [attr.aria-pressed]="d.critical" [attr.aria-label]="'Critical: ' + (d.name || 'new defect')" (click)="toggleCrit(g.name, d)">!</button>
                  </span>
                  <span class="name">
                    @if (d.fromMaster) { {{ d.name }} } @else {
                      <input class="input" [value]="d.name" [placeholder]="t('Defect_TypeName')" [disabled]="store.locked()" [attr.aria-label]="t('Defect_TypeName')" (change)="patch(g.name, d.id, { name: $any($event.target).value })" />
                    }
                  </span>
                  <input class="input" [value]="d.comments" [placeholder]="t('Common_EnterYourRemarks')" [disabled]="store.locked()" [attr.aria-label]="t('Defect_Remarks') + ' ' + d.name" (input)="patch(g.name, d.id, { comments: $any($event.target).value })" />
                  <span class="cnt"><app-counter-stepper [value]="d.major" (valueChange)="patch(g.name, d.id, { major: $event })" [label]="t('Defect_Major') + ' ' + d.name" [disabled]="store.locked()" /></span>
                  <span class="cnt"><app-counter-stepper [value]="d.minor" (valueChange)="patch(g.name, d.id, { minor: $event })" [label]="t('Defect_Minor') + ' ' + d.name" [disabled]="store.locked()" /></span>
                  @if (micro) {
                    <span class="cnt"><app-counter-stepper [value]="d.micro" (valueChange)="patch(g.name, d.id, { micro: $event })" [label]="t('Defect_Micro') + ' ' + d.name" [disabled]="store.locked()" /></span>
                  }
                  <span class="act">
                    <button type="button" class="photo" [class.has]="d.photos.length" (click)="photos(g.name, d)" [attr.aria-label]="t('Common_AddAttachment') + ': ' + d.name + ' (' + d.photos.length + ')'"><app-icon name="image" [size]="26" /></button>
                    @for (p of d.photos.slice(0, 2); track p.id) {
                      <button type="button" class="mini" (click)="rename()" [title]="p.name + ' – ' + t('Rename_Title')"><img [src]="p.dataUrl" [alt]="p.name" /></button>
                    }
                    @if (d.photos.length > 2) {<small>+{{ d.photos.length - 2 }}</small>}
                  </span>
                </div>
              } @empty {
                <p class="emptyrow">{{ g.master ? t('Defect_EmptyGroupMaster') : t('Defect_EmptyGroup') }}</p>
              }
            </div>
            @if (g.master && !store.locked()) {
              <div class="sel"><button type="button" class="selbtn" (click)="selectDefects(g)">☑ {{ t('Defect_SelectDefects') }} <span>›</span></button></div>
            }
          }
        </section>
      }

      @if (store.defects(); as d) {
        <section class="totals card" aria-label="Defect totals">
          <table>
            <thead><tr><th></th><th>{{ t('Defect_Major') }}</th><th>{{ t('Defect_Minor') }}</th>@if (micro) {<th>{{ t('Defect_Micro') }}</th>}<th>{{ t('Common_Total') }}</th></tr></thead>
            <tbody>
              <tr><th scope="row">{{ t('Defect_Actual') }}</th>
                <td [class.over]="store.defectWarn()?.major">{{ d.major }}</td><td [class.over]="store.defectWarn()?.minor">{{ d.minor }}</td>
                @if (micro) {<td [class.over]="store.defectWarn()?.micro">{{ d.micro }}</td>}<td [class.over]="store.defectWarn()?.total">{{ d.total }}</td></tr>
              @if (f.defects.config.substitution.enabled) {
                <tr><th scope="row">{{ t('Defect_EqTotal') }}</th><td>{{ d.eqMajor }}</td><td>{{ d.eqMinor }}</td>@if (micro) {<td></td>}<td>{{ d.eqTotal }}</td></tr>
              }
              @if (f.defects.config.showAcceptedLimit) {
                <tr><th scope="row">{{ t('Defect_AcLimit') }}</th><td>{{ f.defects.config.limits.major }}</td><td>{{ f.defects.config.limits.minor }}</td>@if (micro) {<td>{{ f.defects.config.limits.micro }}</td>}<td>{{ f.defects.config.limits.total }}</td></tr>
              }
            </tbody>
          </table>
        </section>
      }
    }
  `,
  styles: `
    .group{margin-bottom:14px;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff}
    .ghead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;background:#f4f9fa;flex-wrap:wrap}
    .gtitle{display:flex;align-items:center;gap:8px;border:0;background:none;font:inherit;font-size:18px;font-weight:700;color:#1b3a8a;cursor:pointer;min-height:44px;text-align:left}
    .gtitle small{font-size:12px;font-weight:400;color:var(--muted);margin-left:6px}.gtitle b.hl{color:var(--danger)}
    .gacts{display:flex;gap:8px}
    .gbtn{display:inline-flex;align-items:center;gap:4px;min-height:40px;padding:0 14px;border:0;border-radius:4px;color:#fff;font:inherit;font-weight:600;cursor:pointer}
    .gbtn.add{background:#12a3b4}.gbtn.del{background:#e5383b}.gbtn:hover{filter:brightness(1.08)}
    .scroll{overflow-x:auto}
    .grid{display:grid;grid-template-columns:56px 66px minmax(150px,1.1fr) minmax(150px,1.4fr) 132px 132px 150px;gap:6px 8px;align-items:center;padding:4px 8px;min-width:780px}
    .grid.micro{grid-template-columns:56px 66px minmax(150px,1.1fr) minmax(150px,1.4fr) 132px 132px 132px 150px;min-width:910px}
    .hdr{background:#12a3b4;color:#fff;font-weight:600;text-align:center;min-height:42px}.hdr .l{text-align:left}
    .row{border-bottom:1px solid var(--line);min-height:56px;content-visibility:auto;contain-intrinsic-size:auto 56px}
    .row.critrow{box-shadow:inset 3px 0 0 var(--danger)}
    .c{display:grid;place-items:center}.c input{width:20px;height:20px;accent-color:var(--brand-dark)}
    .name{font-size:14px;color:#1b3a8a;min-width:0}
    .crit{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--danger);color:#fff;font-weight:800}
    .critslot{width:30px;height:30px;border-radius:50%;border:1.5px dashed var(--line-strong);background:#fff;color:#c4cbd0;font-weight:800;cursor:pointer}
    .critslot.on{background:var(--danger);border:1.5px solid var(--danger);color:#fff}.critslot:hover:not(:disabled){border-color:var(--danger);color:var(--danger)}.critslot.on:hover{color:#fff}
    .cnt{display:flex;justify-content:center}
    .act{display:flex;align-items:center;justify-content:center;gap:4px}
    .photo{width:40px;height:40px;border:0;border-radius:50%;background:transparent;color:#a6b0b5;cursor:pointer;display:grid;place-items:center}
    .photo.has{color:var(--brand)}.photo:hover{background:var(--brand-soft)}
    .mini{width:30px;height:30px;padding:0;border:1px solid var(--line);border-radius:4px;overflow:hidden;cursor:pointer;background:#fff}.mini img{width:100%;height:100%;object-fit:cover}
    .act small{font-size:11px;color:var(--muted)}
    .emptyrow{margin:0;padding:16px;text-align:center;color:var(--muted)}
    .sel{display:flex;justify-content:center;padding:10px}
    .selbtn{display:inline-flex;align-items:center;gap:10px;min-height:42px;padding:0 24px;border:0;border-radius:4px;background:#12a3b4;color:#fff;font:inherit;font-weight:600;cursor:pointer}
    .selbtn:hover{filter:brightness(1.08)}.selbtn span{font-size:22px;line-height:1}
    .totals{padding:8px 12px;margin-top:16px}
    .totals table{width:100%;border-collapse:collapse;text-align:center}
    .totals th,.totals td{padding:6px;border-bottom:1px solid var(--line)}
    .totals th[scope=row]{text-align:left;font-weight:600}
    .totals td.over{color:var(--danger);font-weight:700}
  `,
})
export class DefectsSection implements OnInit {
  protected readonly store = inject(InspectionStore);
  protected readonly t = inject(I18n).t;
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(Toast);
  private readonly renamer = inject(PhotoRenamer);
  protected readonly collapsed = signal<ReadonlySet<string>>(new Set());
  protected readonly critEditable = criticalEditable;

  ngOnInit(): void {
    this.store.activeSection.set(KEY);
  }

  protected majorOf = (g: DefectGroup): number => g.items.reduce((a, d) => a + d.major, 0);
  protected minorOf = (g: DefectGroup): number => g.items.reduce((a, d) => a + d.minor, 0);

  protected toggleGroup(name: string): void {
    this.collapsed.update((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  }

  private updateGroup(name: string, fn: (g: DefectGroup) => DefectGroup): void {
    this.store.update(KEY, 'defects', (d) => ({ ...d, groups: d.groups.map((g) => (g.name === name ? fn(g) : g)) }));
  }

  protected patch(group: string, id: string, p: Partial<DefectItem>): void {
    this.updateGroup(group, (g) => ({ ...g, items: g.items.map((d) => (d.id === id ? { ...d, ...p } : d)) }));
  }

  protected toggleCrit(group: string, d: DefectItem): void {
    if (criticalEditable(d)) this.patch(group, d.id, { critical: !d.critical });
  }

  /** Add a free-text defect row to this group (same as the "Other Defects" Add). */
  protected add(group: string): void {
    const row = newManualDefect();
    this.collapsed.update((s) => {
      const n = new Set(s);
      n.delete(group);
      return n;
    });
    this.updateGroup(group, (g) => ({ ...g, items: [...g.items, row] }));
    setTimeout(() => document.querySelector<HTMLInputElement>(`input[aria-label="${this.t('Defect_TypeName')}"]:last-of-type`)?.focus(), 80);
  }

  /** Delete the ticked rows; Default master rows are locked. */
  protected del(group: string): void {
    const g = this.store.form()?.defects.groups.find((x) => x.name === group);
    if (!g) return;
    const { group: next, removed } = deleteSelected(g);
    if (!removed.length) {
      this.toast.info(this.t('Defect_TickToDelete'));
      return;
    }
    this.updateGroup(group, () => next);
    this.toast.success(this.t('Defect_Deleted', { n: removed.length }));
  }

  /** "Select defects": choose from the master list of the group (Default ones are locked). */
  protected async selectDefects(g: DefectGroup): Promise<void> {
    const ref = this.dialog.open<SelectDefectsDialog, { group: DefectGroup }, ReadonlySet<string>>(SelectDefectsDialog, {
      data: { group: g }, width: '640px', maxWidth: '96vw', panelClass: 'addon-dialog', autoFocus: false,
    });
    const checked = await firstValueFrom(ref.afterClosed());
    if (!checked) return;
    const res = applyMasterSelection(g, checked);
    if (!res.added && !res.removed) {
      this.toast.info(this.t('Defect_NoChange'));
      return;
    }
    this.updateGroup(g.name, () => res.group);
    this.toast.success(this.t('Defect_SelectResult', { a: res.added, r: res.removed, g: g.name }));
  }

  protected async photos(group: string, d: DefectItem): Promise<void> {
    if (!d.name.trim()) {
      this.toast.info(this.t('Defect_PhotoNeedsName'));
      return;
    }
    const ref = this.dialog.open<DefectPhotosDialog, { title: string; photos: PhotoAttachment[]; readonly: boolean }, PhotoAttachment[]>(DefectPhotosDialog, {
      data: { title: d.name, photos: d.photos, readonly: this.store.locked() }, maxWidth: '94vw',
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (result) this.patch(group, d.id, { photos: result });
  }

  /** Tap any photo -> rename all photos of this tab on one screen. */
  protected rename(): void {
    void this.renamer.open(this.store, KEY);
  }
}

import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { I18n } from '../../../core/i18n/i18n';
import { EvalArea, EvalCheckPoint, EvalGroup } from '../../../domain/models/inspection';
import { PhotoPicker } from '../../../shared/photo-picker';
import { PhotoStrip } from '../../../shared/photo-strip';
import { SelectField } from '../../../shared/select-field';
import { InspectionStore } from '../inspection-store';
import { PhotoRenamer } from '../photo-rename';

/**
 * Config-driven evaluation renderer – one component for Measurement Results, Quality Results, Packing
 * Results and any other evaluation group. Looks like the source: area heading, teal header row
 * (Checkpoint | Result | Comments), "Select" dropdowns, photo tile, teal "Result" bar with a dropdown.
 * The group Result is chosen manually, not derived from checkpoints (docs BR-E4 / Q-8).
 */
@Component({
  selector: 'app-evaluation-section',
  imports: [PhotoStrip, SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (group(); as g) {
      @for (a of g.areas; track a.id) {
        <section class="area">
          <h2>{{ a.name }}</h2>
          <div class="box">
            <div class="tr th" role="row" [class.sub]="a.showSubCheckPoint" [class.act]="a.showActualValue">
              <span role="columnheader">{{ t('CustomPage_Checkpoint') }}</span>
              @if (a.showSubCheckPoint) {<span role="columnheader">{{ t('CustomPage_SubCheckpoint') }}</span>}
              <span role="columnheader">{{ t('CustomPage_Result') }}</span>
              @if (a.showActualValue) {<span role="columnheader">{{ t('CustomPage_ActualValue') }}</span>}
              <span role="columnheader">{{ t('Common_Comments') }}</span>
            </div>
            @if (a.checkPointEnabled) {
              @for (c of a.checkPoints; track c.id) {
                <div class="tr" role="row" [class.sub]="a.showSubCheckPoint" [class.act]="a.showActualValue">
                  <span role="cell" class="nm">{{ c.name }}</span>
                  @if (a.showSubCheckPoint) {<span role="cell">{{ c.subName }}</span>}
                  <span role="cell">
                    <app-select-field [options]="cpOpts()" [value]="c.judgementId" (valueChange)="setCp(a.id, c.id, 'judgementId', $any($event))" [title]="c.name" [placeholder]="t('Common_Select')" [disabled]="store.locked()" />
                  </span>
                  @if (a.showActualValue) {
                    <span role="cell"><input class="input" [value]="c.actualValue" [readOnly]="c.actualReadonly || store.locked()" [placeholder]="t('CustomPage_ActualValue')" [attr.aria-label]="c.name + ' ' + t('CustomPage_ActualValue')" (input)="setCp(a.id, c.id, 'actualValue', $any($event.target).value)" /></span>
                  }
                  <span role="cell"><input class="input" [value]="c.comments" [disabled]="store.locked()" [placeholder]="t('Common_Comments')" [attr.aria-label]="c.name + ' ' + t('Common_Comments')" (input)="setCp(a.id, c.id, 'comments', $any($event.target).value)" /></span>
                </div>
              }
            }
            @if (a.commentEnabled) {
              <div class="cm"><textarea class="textarea" [value]="a.comments" [disabled]="store.locked()" [placeholder]="t('Common_Comments')" [attr.aria-label]="a.name + ' ' + t('Common_Comments')" (input)="setArea(a.id, 'comments', $any($event.target).value)"></textarea></div>
            }
            @if (a.attachmentsEnabled) {
              <div class="ph"><app-photo-strip [previewOnClick]="false" (photoOpen)="rename()" [photos]="a.attachments" [readonly]="store.locked()" (add)="addPhotos(a.id)" (remove)="removePhoto(a.id, $event)" /></div>
            }
          </div>
          @if (a.judgementEnabled) {
            <div class="bar">
              <span>{{ t('CustomPage_Result') }}</span>
              <app-select-field class="onbar" [options]="resultOpts()" [value]="a.judgementId" (valueChange)="setArea(a.id, 'judgementId', $any($event))" [title]="t('CustomPage_Result')" [placeholder]="t('Common_Select')" [disabled]="store.locked()" />
            </div>
          }
        </section>
      }

      @if (g.judgementEnabled) {
        <div class="bar">
          <span>{{ t('CustomPage_Result') }}</span>
          <app-select-field class="onbar" [options]="resultOpts()" [value]="g.judgementId" (valueChange)="setGroup('judgementId', $any($event))" [title]="t('CustomPage_Result')" [placeholder]="t('Common_Select')" [disabled]="store.locked()" />
        </div>
      }
    }
  `,
  styles: `
    .area{margin-bottom:14px}
    h2{margin:6px 6px 8px;font-size:20px;font-weight:600;color:#444}
    .box{border:1px solid var(--line)}
    .tr{display:grid;grid-template-columns:minmax(120px,1fr) minmax(150px,1fr) minmax(130px,1fr);gap:8px;align-items:center;padding:4px 6px;border-bottom:1px solid var(--line);min-height:56px}
    .tr.sub{grid-template-columns:minmax(110px,1fr) minmax(90px,.8fr) minmax(150px,1fr) minmax(120px,1fr)}
    .tr.act{grid-template-columns:minmax(110px,1fr) minmax(150px,1fr) minmax(100px,.8fr) minmax(120px,1fr)}
    .tr.sub.act{grid-template-columns:minmax(100px,1fr) minmax(80px,.8fr) minmax(140px,1fr) minmax(90px,.8fr) minmax(110px,1fr)}
    .th{background:#3dbccb;color:#fff;font-size:16px;min-height:46px;text-align:center}
    .th>span{text-align:center}
    .nm{font-size:15px;color:#333}
    .cm{padding:10px}.cm .textarea{min-height:110px}
    .ph{padding:6px 10px}
    .bar{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:70px;padding:10px;background:#3dbccb;color:#fff;font-size:17px;margin-top:10px}
    .onbar{width:min(300px,55%);--surface:transparent;--line-strong:#fff;color:#fff}
    ::ng-deep .onbar .field{color:#fff}
    @media (max-width:520px){
      .tr,.tr.sub,.tr.act,.tr.sub.act{grid-template-columns:minmax(80px,.9fr) minmax(110px,1fr) minmax(90px,.9fr);font-size:13px}
      .tr.sub,.tr.act{grid-template-columns:minmax(70px,.8fr) minmax(70px,.8fr) minmax(100px,1fr) minmax(80px,.8fr)}
    }
  `,
})
export class EvaluationSection {
  readonly groupId = input.required<string>();
  protected readonly store = inject(InspectionStore);
  protected readonly t = inject(I18n).t;
  private readonly picker = inject(PhotoPicker);
  private readonly renamer = inject(PhotoRenamer);

  protected readonly group = computed<EvalGroup | null>(() => this.store.form()?.evaluation.find((g) => g.id === this.groupId()) ?? null);
  protected readonly cpOpts = computed(() => (this.group()?.checkPointJudgements ?? []).map((j) => ({ id: j.id, label: j.name })));
  protected readonly resultOpts = computed(() => (this.group()?.resultJudgements ?? []).map((j) => ({ id: j.id, label: j.name })));

  constructor() {
    effect(() => {
      const s = this.store.sectionForGroup(this.groupId());
      if (s) this.store.activeSection.set(s.key);
    });
  }

  /** Tap any photo -> rename all photos of this tab on one screen. */
  protected rename(): void {
    void this.renamer.open(this.store, this.key());
  }

  private key(): string {
    return this.store.sectionForGroup(this.groupId())?.key ?? this.groupId();
  }

  private updateGroup(fn: (g: EvalGroup) => EvalGroup): void {
    this.store.update(this.key(), 'evaluation', (list) => list.map((g) => (g.id === this.groupId() ? fn(g) : g)));
  }

  private updateArea(areaId: string, fn: (a: EvalArea) => EvalArea): void {
    this.updateGroup((g) => ({ ...g, areas: g.areas.map((a) => (a.id === areaId ? fn(a) : a)) }));
  }

  protected setGroup(field: 'judgementId', v: string | null): void {
    this.updateGroup((g) => ({ ...g, [field]: v }));
  }

  protected setArea<K extends 'judgementId' | 'comments'>(areaId: string, field: K, v: EvalArea[K]): void {
    this.updateArea(areaId, (a) => ({ ...a, [field]: v }));
  }

  protected setCp<K extends 'judgementId' | 'actualValue' | 'comments'>(areaId: string, cpId: string, field: K, v: EvalCheckPoint[K]): void {
    this.updateArea(areaId, (a) => ({ ...a, checkPoints: a.checkPoints.map((c) => (c.id === cpId ? { ...c, [field]: v } : c)) }));
  }

  protected async addPhotos(areaId: string): Promise<void> {
    const photos = await this.picker.pick();
    if (photos.length) this.updateArea(areaId, (a) => ({ ...a, attachments: [...a.attachments, ...photos] }));
  }

  protected removePhoto(areaId: string, id: string): void {
    this.updateArea(areaId, (a) => ({ ...a, attachments: a.attachments.filter((p) => p.id !== id) }));
  }
}

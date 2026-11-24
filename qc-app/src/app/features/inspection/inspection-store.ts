import { Injectable, computed, inject, signal } from '@angular/core';
import { FormStore } from '../../core/sync/form-store';
import { LocalDb } from '../../core/storage/local-db';
import { InspectionForm, InspectionSection, PhotoAttachment } from '../../domain/models/inspection';
import { normalizeDefects } from '../../domain/rules/defect-groups.rule';
import { defectTotals, overLimit } from '../../domain/rules/defect.rule';
import { canSubmit, readiness } from '../../domain/rules/submit.rule';
import { summaryTotals } from '../../domain/rules/summary.rule';

import type { RenameGroup } from './photo-rename';

export type SliceKey = 'summary' | 'ra' | 'measurement' | 'defects' | 'evaluation' | 'final';
export type SectionStatus = 'new' | 'edited' | 'saved';

interface Wip {
  form: InspectionForm;
  dirty: string[];
}

/**
 * State of ONE inspection (an order's result). Provided by the inspection shell route, so it lives
 * exactly as long as the user stays in the inspection.
 *  - edits are immutable slice updates (cheap, OnPush friendly) and mark the section "edited"
 *  - Save persists the draft locally and marks the section "saved"; Discard reverts to the last save
 *  - a debounced work-in-progress copy survives reloads
 */
@Injectable()
export class InspectionStore {
  private readonly forms = inject(FormStore);
  private readonly db = inject(LocalDb);

  readonly form = signal<InspectionForm | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly dirty = signal<ReadonlySet<string>>(new Set());
  readonly activeSection = signal<string>('summary');

  private baseline: InspectionForm | null = null;
  private wipTimer?: ReturnType<typeof setTimeout>;
  private orderId = '';

  readonly locked = computed(() => this.form()?.status === 'submitted');
  readonly hasUnsaved = computed(() => this.dirty().size > 0);
  readonly sections = computed(() => this.form()?.sections ?? []);

  readonly totals = computed(() => {
    const f = this.form();
    return f ? summaryTotals(f.summary.rows) : null;
  });
  readonly defectAll = computed(() => {
    const f = this.form();
    return f ? f.defects.groups.flatMap((g) => g.items) : [];
  });
  readonly defects = computed(() => {
    const f = this.form();
    return f ? defectTotals(this.defectAll(), f.defects.config) : null;
  });
  readonly defectWarn = computed(() => {
    const f = this.form();
    const d = this.defects();
    return f && d ? overLimit(d, f.defects.config) : null;
  });
  readonly readiness = computed(() => (this.form() ? readiness(this.form()!) : []));
  readonly canSubmit = computed(() => (this.form() ? canSubmit(this.form()!) : false));

  async load(orderId: string): Promise<void> {
    this.orderId = orderId;
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const form = await this.forms.load(orderId);
      this.baseline = structuredClone(form);
      const wip = await this.db.get<Wip>(`wip:${orderId}`);
      if (wip && form.status !== 'submitted') {
        this.form.set(normalizeDefects(wip.form));
        this.dirty.set(new Set(wip.dirty));
      } else {
        this.form.set(form);
        this.dirty.set(new Set());
      }
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  sectionOf(key: string): InspectionSection | undefined {
    return this.sections().find((s) => s.key === key);
  }

  sectionForGroup(groupId: string): InspectionSection | undefined {
    return this.sections().find((s) => s.groupId === groupId);
  }

  statusOf(key: string): SectionStatus {
    if (this.dirty().has(key)) return 'edited';
    return this.form()?.savedSections.includes(key) ? 'saved' : 'new';
  }

  /** Immutable slice update + dirty marking. */
  update<K extends SliceKey>(sectionKey: string, slice: K, fn: (v: InspectionForm[K]) => InspectionForm[K]): void {
    const f = this.form();
    if (!f || this.locked()) return;
    this.form.set({ ...f, [slice]: fn(f[slice]) });
    this.dirty.update((d) => new Set(d).add(sectionKey));
    this.scheduleWip();
  }

  async save(sectionKey: string): Promise<void> {
    const f = this.form();
    if (!f || this.locked()) return;
    const saved = f.savedSections.includes(sectionKey) ? f.savedSections : [...f.savedSections, sectionKey];
    const next = { ...f, savedSections: saved };
    this.form.set(next);
    this.baseline = structuredClone(next);
    this.dirty.update((d) => {
      const n = new Set(d);
      n.delete(sectionKey);
      return n;
    });
    await this.forms.saveDraft(next);
    await this.persistWip();
  }

  /** Revert a section to its last saved state. */
  discard(sectionKey: string): void {
    const f = this.form();
    const base = this.baseline;
    const section = this.sectionOf(sectionKey);
    if (!f || !base || !section || this.locked()) return;
    let next: InspectionForm = f;
    switch (section.kind) {
      case 'summary': next = { ...f, summary: structuredClone(base.summary) }; break;
      case 'ra': next = { ...f, ra: structuredClone(base.ra) }; break;
      case 'measurement': next = { ...f, measurement: structuredClone(base.measurement) }; break;
      case 'defects': next = { ...f, defects: structuredClone(base.defects) }; break;
      case 'final': next = { ...f, final: structuredClone(base.final) }; break;
      case 'evaluation':
        next = { ...f, evaluation: f.evaluation.map((g) => (g.id === section.groupId ? structuredClone(base.evaluation.find((b) => b.id === g.id) ?? g) : g)) };
        break;
    }
    this.form.set(next);
    this.dirty.update((d) => {
      const n = new Set(d);
      n.delete(sectionKey);
      return n;
    });
    this.scheduleWip();
  }

  /** Final submit (local outbox; Sync pushes it). */
  async submit(): Promise<boolean> {
    const f = this.form();
    if (!f || !this.canSubmit() || this.locked()) return false;
    const status = f.final.judgements.find((j) => j.id === f.final.judgementId)?.name ?? '';
    const all: InspectionForm = { ...f, savedSections: f.sections.map((s) => s.key) };
    await this.forms.submitLocal(all, status);
    await this.db.remove(`wip:${this.orderId}`);
    clearTimeout(this.wipTimer);
    this.dirty.set(new Set());
    this.form.set({ ...all, status: 'submitted' });
    return true;
  }

  /* ---------------------------------------------------------------- work-in-progress copy */
  private scheduleWip(): void {
    clearTimeout(this.wipTimer);
    this.wipTimer = setTimeout(() => void this.persistWip(), 1200);
  }

  private async persistWip(): Promise<void> {
    const f = this.form();
    if (!f) return;
    if (this.dirty().size === 0) await this.db.remove(`wip:${this.orderId}`);
    else await this.db.set<Wip>(`wip:${this.orderId}`, { form: f, dirty: [...this.dirty()] });
  }

  /* ---------------------------------------------------------------- photo rename (one screen per tab) */
  /** All photos of a section grouped like the tab (defect groups / evaluation areas / activities / final). */
  photoGroups(sectionKey: string): RenameGroup[] {
    const f = this.form();
    const section = this.sectionOf(sectionKey);
    if (!f || !section) return [];
    switch (section.kind) {
      case 'defects':
        return f.defects.groups.map((g) => ({ title: g.name, rows: g.items.flatMap((d) => d.photos.map((photo) => ({ photo, note: d.name }))) }));
      case 'evaluation':
        return (f.evaluation.find((g) => g.id === section.groupId)?.areas ?? []).map((a) => ({ title: a.name.toUpperCase(), rows: a.attachments.map((photo) => ({ photo, note: '' })) }));
      case 'ra':
        return f.ra.map((r) => ({ title: r.activity.toUpperCase(), rows: r.attachments.map((photo) => ({ photo, note: '' })) }));
      case 'final':
        return [{ title: 'FINAL RESULT', rows: f.final.attachments.map((photo) => ({ photo, note: '' })) }];
      default:
        return [];
    }
  }

  /** Apply the names typed on the rename screen; returns how many photos changed. */
  renamePhotos(sectionKey: string, names: Record<string, string>): number {
    const section = this.sectionOf(sectionKey);
    if (!section) return 0;
    let changed = 0;
    const map = (list: PhotoAttachment[]): PhotoAttachment[] =>
      list.map((p) => {
        const n = names[p.id]?.trim();
        if (n && n !== p.name) {
          changed++;
          return { ...p, name: n };
        }
        return p;
      });
    switch (section.kind) {
      case 'defects':
        this.update(sectionKey, 'defects', (d) => ({ ...d, groups: d.groups.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, photos: map(i.photos) })) })) }));
        break;
      case 'evaluation':
        this.update(sectionKey, 'evaluation', (list) => list.map((g) => (g.id === section.groupId ? { ...g, areas: g.areas.map((a) => ({ ...a, attachments: map(a.attachments) })) } : g)));
        break;
      case 'ra':
        this.update(sectionKey, 'ra', (rows) => rows.map((r) => ({ ...r, attachments: map(r.attachments) })));
        break;
      case 'final':
        this.update(sectionKey, 'final', (fr) => ({ ...fr, attachments: map(fr.attachments) }));
        break;
    }
    return changed;
  }

  dispose(): void {
    clearTimeout(this.wipTimer);
    void this.persistWip();
  }
}

import { DefectGroup, DefectItem, InspectionForm } from '../models/inspection';

/**
 * Group-wise defect entry (requirements doc – Triton items 1–3):
 *  - every group has Add / Delete, like the "Other Defects" group at the end
 *  - master defects flagged Default are always shown (locked); the rest are picked with "Select Defects"
 *  - Critical starts from the master flag for master rows; on every row it can be toggled by the QC
 */
export const OTHER_GROUP = 'OTHER DEFECTS';

export function newManualDefect(id: string = crypto.randomUUID()): DefectItem {
  return { id, name: '', critical: false, comments: '', major: 0, minor: 0, micro: 0, photos: [], fromMaster: false, isDefault: false, selected: false };
}

/**
 * Critical can be marked on every row. Master rows start with the master's Critical flag and the QC may
 * change it for this inspection (requested change – the requirements doc had master rows read-only).
 */
export const criticalEditable = (_d: DefectItem): boolean => true;

export function toggleCritical(d: DefectItem): DefectItem {
  return { ...d, critical: !d.critical };
}

/** A row can be deleted when it is not a Default master row. */
export const deletable = (d: DefectItem): boolean => !d.isDefault;

export function deleteSelected(g: DefectGroup): { group: DefectGroup; removed: DefectItem[] } {
  const removed = g.items.filter((d) => d.selected && deletable(d));
  return { group: { ...g, items: g.items.filter((d) => !(d.selected && deletable(d))) }, removed };
}

/** Names currently shown for the group's master entries (Default entries are always included). */
export function initialSelection(g: DefectGroup): Set<string> {
  const present = new Set(g.items.filter((d) => d.fromMaster).map((d) => d.name));
  return new Set((g.master ?? []).filter((m) => m.isDefault || present.has(m.name)).map((m) => m.name));
}

/**
 * Apply the "Select Defects" choice: add newly ticked master defects (with their master Critical flag),
 * remove unticked non-default ones. Manual rows are untouched.
 */
export function applyMasterSelection(g: DefectGroup, checked: ReadonlySet<string>, newId: () => string = () => crypto.randomUUID()): { group: DefectGroup; added: number; removed: number } {
  let items = [...g.items];
  let added = 0;
  let removed = 0;
  for (const m of g.master ?? []) {
    const has = items.find((d) => d.fromMaster && d.name === m.name);
    if (checked.has(m.name) && !has) {
      items.push({ ...newManualDefect(newId()), name: m.name, critical: m.critical, comments: '', fromMaster: true, isDefault: m.isDefault });
      added++;
    } else if (!checked.has(m.name) && has && !has.isDefault) {
      items = items.filter((d) => d !== has);
      removed++;
    }
  }
  return { group: { ...g, items }, added, removed };
}

/**
 * Forms saved before the Add-Ons change have a separate "others" list and no master info.
 * Migrate them: others -> final OTHER DEFECTS group; existing rows become default master rows.
 */
export function normalizeDefects(form: InspectionForm): InspectionForm {
  const legacy = (form.defects as unknown as { others?: DefectItem[] }).others;
  let groups = form.defects.groups.map((g) => ({
    ...g,
    items: g.items.map((d) => ({ ...d, fromMaster: d.fromMaster ?? !!g.master, isDefault: d.isDefault ?? !!g.master, selected: d.selected ?? false })),
  }));
  if (!groups.some((g) => g.name === OTHER_GROUP)) {
    groups = [...groups, { name: OTHER_GROUP, items: (legacy ?? []).map((d) => ({ ...d, fromMaster: false, isDefault: false, selected: false })) }];
  }
  const { others: _o, ...rest } = form.defects as unknown as Record<string, unknown>;
  return { ...form, defects: { ...(rest as unknown as InspectionForm['defects']), groups } };
}

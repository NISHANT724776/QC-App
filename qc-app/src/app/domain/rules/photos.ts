import { InspectionForm, PhotoAttachment } from '../models/inspection';

/** Every photo attached anywhere in a form (RA, defects, evaluation areas, final result). */
export function photosOf(form: InspectionForm): PhotoAttachment[] {
  return [
    ...form.ra.flatMap((r) => r.attachments),
    ...form.defects.groups.flatMap((g) => g.items.flatMap((i) => i.photos)),
    ...form.evaluation.flatMap((g) => g.areas.flatMap((a) => a.attachments)),
    ...form.final.attachments,
  ];
}

/** A photo together with where in the form it was added (for the Images page). */
export interface PhotoEntry {
  photo: PhotoAttachment;
  source: string;
}

export function photoEntries(form: InspectionForm): PhotoEntry[] {
  return [
    ...form.ra.flatMap((r) => r.attachments.map((photo) => ({ photo, source: `RA Sheet · ${r.activity}` }))),
    ...form.defects.groups.flatMap((g) => g.items.flatMap((i) => i.photos.map((photo) => ({ photo, source: `Defects · ${g.name} · ${i.name || 'New defect'}` })))),
    ...form.evaluation.flatMap((g) => g.areas.flatMap((a) => a.attachments.map((photo) => ({ photo, source: `${g.name} · ${a.name}` })))),
    ...form.final.attachments.map((photo) => ({ photo, source: 'Final result' })),
  ];
}

export function pendingPhotos(form: InspectionForm): PhotoAttachment[] {
  return photosOf(form).filter((p) => !p.uploaded);
}

/** Marks photos as uploaded (mutates a form copy) – used after the upload queue succeeds. */
export function markPhotosUploaded(form: InspectionForm): InspectionForm {
  for (const p of photosOf(form)) p.uploaded = true;
  return form;
}

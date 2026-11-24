import { InspectionForm } from '../models/inspection';

export interface ReadinessItem {
  key: string;
  label: string;
  done: boolean;
  /** blocking = must be done before Submit */
  blocking: boolean;
}

/**
 * ASSUMPTION (docs BR-F8 / Q-9): Submit requires Judgement date, Judgement and both signatures.
 * Other sections only produce a (non-blocking) "saved" reminder.
 */
export function readiness(form: InspectionForm): ReadinessItem[] {
  const items: ReadinessItem[] = form.sections
    .filter((s) => s.kind !== 'final')
    .map((s) => ({
      key: s.key,
      label: s.label,
      done: form.savedSections.includes(s.key),
      blocking: false,
    }));
  items.push(
    { key: 'judgement', label: 'Judgement', done: !!form.final.judgementId, blocking: true },
    { key: 'date', label: 'Judgement date', done: !!form.final.judgementDate, blocking: true },
    { key: 'qc', label: 'Quality Controller signature', done: !!form.final.qcSignature, blocking: true },
    { key: 'fr', label: 'Factory Representative signature', done: !!form.final.frSignature, blocking: true },
  );
  return items;
}

export function canSubmit(form: InspectionForm): boolean {
  return readiness(form).every((i) => !i.blocking || i.done);
}

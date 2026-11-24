import { CanDeactivateFn } from '@angular/router';
import type { InspectionShell } from './inspection-shell';

export const unsavedChangesGuard: CanDeactivateFn<InspectionShell> = (component) => component.canLeave();

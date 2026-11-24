import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth';

/**
 * True when the app runs inside the Screen preview page (same origin, /preview): Register and PIN may then be
 * shown for viewing even though the user is already signed in.
 */
function inPreviewFrame(): boolean {
  try {
    return window.parent !== window && window.parent.location.pathname === '/preview';
  } catch {
    return false; // cross-origin parent
  }
}

/** Everything except /register and /pin requires: registered -> PIN created -> unlocked. */
export const appGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (!auth.isRegistered()) return router.createUrlTree(['/register']);
  if (!auth.hasPin() || !auth.unlocked()) return router.createUrlTree(['/pin']);
  return true;
};

export const registerGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (inPreviewFrame()) return true;
  if (!auth.isRegistered()) return true;
  return router.createUrlTree([auth.hasPin() && auth.unlocked() ? '/requests' : '/pin']);
};

export const pinGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (inPreviewFrame()) return true;
  if (!auth.isRegistered()) return router.createUrlTree(['/register']);
  if (auth.hasPin() && auth.unlocked()) return router.createUrlTree(['/requests']);
  return true;
};

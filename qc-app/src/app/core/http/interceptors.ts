import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Auth } from '../auth/auth';
import { I18n } from '../i18n/i18n';
import { Toast } from '../ui/toast';

/**
 * Tenant + auth interceptor: requests to `/api/...` are sent to the registered Company URL with the
 * session token. (Unused while the mock data layer is active – ready for the real API, docs Q-3.)
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const reg = inject(Auth).registration();
  if (!reg || !req.url.startsWith('/api/')) return next(req);
  return next(
    req.clone({ url: `${reg.companyUrl}${req.url}`, setHeaders: { Authorization: `Bearer ${reg.token}`, 'X-Company-Id': reg.companyId } }),
  );
};

/** Centralised HTTP error handling -> toast. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(Toast);
  const t = inject(I18n).t;
  return next(req).pipe(
    catchError((e: HttpErrorResponse) => {
      toast.error(e.status === 0 ? t('Msg_NoInternetConnection') : e.error?.message ?? e.message);
      return throwError(() => e);
    }),
  );
};

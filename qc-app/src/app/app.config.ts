import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideServiceWorker } from '@angular/service-worker';
import { Pwa } from './core/pwa/pwa';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { Auth } from './core/auth/auth';
import { errorInterceptor, tenantInterceptor } from './core/http/interceptors';
import { Settings } from './core/settings/settings';
import { Sync } from './core/sync/sync';
import { provideData } from './data/provide-data';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([tenantInterceptor, errorInterceptor])),
    provideNativeDateAdapter(),
    provideData(),
    // Offline shell + install-as-app. Registers once the app is stable (production build only).
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
    provideAppInitializer(async () => {
      inject(Pwa).init();
      inject(Settings); // applies the saved language before first render
      const auth = inject(Auth);
      const sync = inject(Sync); // resolve everything before the first await
      await auth.init();
      await sync.init();
    }),
  ],
};

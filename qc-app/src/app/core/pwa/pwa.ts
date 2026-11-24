import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter } from 'rxjs';
import { I18n } from '../i18n/i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * "Install as app" support: captures the browser install prompt (Android / desktop Chrome, Edge),
 * explains Add to Home Screen on iPhone / iPad, and tells the user when a new version is ready
 * (the service worker keeps the app and its data layer available offline).
 */
@Injectable({ providedIn: 'root' })
export class Pwa {
  private readonly doc = inject(DOCUMENT);
  private readonly bar = inject(MatSnackBar);
  private readonly t = inject(I18n).t;
  private readonly updates = inject(SwUpdate, { optional: true });
  private deferred: BeforeInstallPromptEvent | null = null;

  private readonly installable = signal(false);
  private readonly standalone = signal(this.detectStandalone());
  private readonly ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  /** Browser can show its own install dialog. */
  readonly canInstall = computed(() => this.installable() && !this.standalone());
  /** iOS Safari has no install API: show the Add to Home Screen instructions instead. */
  readonly showIosHint = computed(() => this.ios && !this.standalone());
  /** The Install button is shown whenever the app is not already running installed. */
  readonly showInstall = computed(() => this.canInstall() || this.showIosHint());

  init(): void {
    const win = this.doc.defaultView;
    win?.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferred = e as BeforeInstallPromptEvent;
      this.installable.set(true);
    });
    win?.addEventListener('appinstalled', () => {
      this.deferred = null;
      this.installable.set(false);
      this.standalone.set(true);
      this.bar.open(this.t('Pwa_Installed'), undefined, { duration: 3000, horizontalPosition: 'center', verticalPosition: 'top', panelClass: ['toast-success'] });
    });
    win?.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => this.standalone.set(e.matches));

    if (this.updates?.isEnabled) {
      this.updates.versionUpdates
        .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
        .subscribe(() => {
          this.bar
            .open(this.t('Pwa_UpdateReady'), this.t('Pwa_Reload'), { duration: 0, horizontalPosition: 'center', verticalPosition: 'bottom' })
            .onAction()
            .subscribe(() => void this.updates!.activateUpdate().then(() => this.doc.location.reload()));
        });
      const check = () => void this.updates!.checkForUpdate().catch(() => undefined);
      this.doc.addEventListener('visibilitychange', () => {
        if (this.doc.visibilityState === 'visible') check();
      });
      setInterval(check, 6 * 60 * 60 * 1000);
    }
  }

  async install(): Promise<void> {
    if (this.deferred) {
      const d = this.deferred;
      this.deferred = null;
      this.installable.set(false);
      await d.prompt();
      await d.userChoice;
      return;
    }
    if (this.showIosHint()) {
      this.bar.open(this.t('Pwa_IosHint'), this.t('Common_Ok'), { duration: 12000, horizontalPosition: 'center', verticalPosition: 'bottom' });
    }
  }

  private detectStandalone(): boolean {
    const nav = navigator as Navigator & { standalone?: boolean };
    return matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
  }
}

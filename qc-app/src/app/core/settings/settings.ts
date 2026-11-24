import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { I18n } from '../i18n/i18n';
import { LangCode } from '../i18n/dictionaries';

export interface AppSettings {
  notification: boolean;
  biometric: boolean;
  optimizeImage: boolean;
  /** The source app has two UI sets (portrait / landscape "Ls"); this switch chooses one (needs a restart). */
  landscapeLayout: boolean;
  language: LangCode;
}

const KEY = 'wfx.settings';
const DEFAULTS: AppSettings = { notification: true, biometric: false, optimizeImage: true, landscapeLayout: false, language: 'en' };

/** Profile toggles, exactly as in the source app (Notification, Biometric, Optimize Image, Landscape Layout, Language). */
@Injectable({ providedIn: 'root' })
export class Settings {
  private readonly i18n = inject(I18n);
  readonly value = signal<AppSettings>(this.load());
  /** true = landscape UI set (Day/Week/Month header, ⋮ menu, matrix views …) */
  readonly landscape = computed(() => this.value().landscapeLayout);

  constructor() {
    effect(() => {
      const v = this.value();
      this.i18n.set(v.language);
      try {
        localStorage.setItem(KEY, JSON.stringify(v));
      } catch {
        /* storage unavailable – settings stay in memory */
      }
    });
  }

  patch(p: Partial<AppSettings>): void {
    const next = { ...this.value(), ...p };
    this.value.set(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next)); // synchronous: a restart may follow immediately
    } catch {
      /* ignore */
    }
  }

  private load(): AppSettings {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) };
    } catch {
      /* ignore */
    }
    return { ...DEFAULTS };
  }
}

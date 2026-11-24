import { Injectable, signal } from '@angular/core';
import { DICTIONARIES, EN, LangCode } from './dictionaries';

/**
 * Runtime language switching (no app restart needed on the web – docs §8).
 * Use in templates as `{{ t('Request_Title') }}`; the signal read makes views update on change.
 */
@Injectable({ providedIn: 'root' })
export class I18n {
  readonly lang = signal<LangCode>('en');

  readonly t = (key: string, params?: Record<string, string | number>): string => {
    let s = DICTIONARIES[this.lang()][key] ?? EN[key] ?? key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };

  set(code: LangCode): void {
    this.lang.set(code);
    document.documentElement.lang = code;
  }
}

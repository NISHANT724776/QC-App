import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { I18n } from '../../core/i18n/i18n';
import { Toast } from '../../core/ui/toast';
import { Icon } from '../../shared/icon';
import { AuthLayout } from './auth-layout';

const URL_PREFIX = 'https://';
const URL_PATTERN =/^https?:\/\/[^\s/$.?#][^\s]*$/i;

/**
 * Device registration (A1). Username, company ID and URL are lower-cased (BR-A1). All four fields
 * are required (assumed – docs §5). Success -> "Login successfully" -> create/enter PIN.
 */
@Component({
  selector: 'app-registration',
  imports: [ReactiveFormsModule, AuthLayout, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout [heading]="t('Registration_Welcome')">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="stack">
          <label class="pill" [class.invalid]="bad('username')">
            <app-icon name="person" [size]="22" />
            <input formControlName="username" [placeholder]="t('Registration_UserNamePlaceholder')" autocomplete="username" autocapitalize="none" spellcheck="false" (input)="lower('username')" aria-label="User name" />
          </label>
          <label class="pill" [class.invalid]="bad('password')">
            <app-icon name="lock" [size]="22" />
            <input type="password" formControlName="password" [placeholder]="t('Registration_PasswordPlaceholder')" autocomplete="current-password" aria-label="Password" />
          </label>
          <label class="pill" [class.invalid]="bad('companyId')">
            <app-icon name="mail" [size]="22" />
            <input formControlName="companyId" [placeholder]="t('Registration_CompanyIdPlaceholder')" autocapitalize="none" spellcheck="false" (input)="lower('companyId')" aria-label="Company ID" />
          </label>
          <label class="pill" [class.invalid]="bad('companyUrl')">
            <app-icon name="globe" [size]="22" />
            <input type="url" inputmode="url" formControlName="companyUrl" [placeholder]="t('Profile_CompanyUrlPlaceholder')" autocapitalize="none" autocorrect="off" spellcheck="false" aria-label="Company URL" aria-describedby="url-hint"
              (focus)="caretToEnd($event)" (input)="lower('companyUrl')" (blur)="fixUrl()" />
          </label>
          <p class="hint" id="url-hint">{{ t('Registration_UrlHint') }}</p>
        </div>
        @if (error()) {
          <p class="err" role="alert">{{ error() }}</p>
        }
        <button class="go" type="submit" [disabled]="busy()">
          @if (busy()) {
            <span class="spin" aria-hidden="true"></span>
          } @else {
            <span class="lbl">{{ t('Registration_Login') }}</span>
            <app-icon name="arrowForward" [size]="26" />
          }
        </button>
      </form>
    </app-auth-layout>
  `,
  styles: `
    .stack{display:grid;gap:14px}
    .hint{margin:-6px 8px 0;font-size:12.5px;line-height:1.35;color:var(--muted);text-align:center}
    .err{color:var(--danger);text-align:center;margin:12px 0 0}
    .go{position:absolute;left:50%;bottom:-34px;transform:translateX(-50%);min-width:68px;height:68px;padding:0 30px;border-radius:34px;border:6px solid #fff;
      background:var(--grad);color:#fff;display:inline-flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;box-shadow:0 2px 8px rgb(0 0 0 / 25%)}
    .lbl{font-size:20px;font-weight:600;letter-spacing:.3px}
    .go:disabled{opacity:.7;cursor:progress}
    .spin{width:26px;height:26px;border:3px solid rgb(255 255 255 / 40%);border-top-color:#fff;border-radius:50%;animation:s .8s linear infinite}
    @keyframes s{to{transform:rotate(360deg)}}
  `,
})
export class RegistrationPage {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);
  protected readonly t = inject(I18n).t;

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = this.fb.group({
    // Pre-filled defaults (requested). The user can overwrite any of them.
    username: ['Nishant', Validators.required],
    password: ['N@724776', Validators.required],
    companyId: ['WFX QC', Validators.required],
    companyUrl: [`${URL_PREFIX}WFXQC_APP`, [Validators.required, Validators.pattern(URL_PATTERN)]],
  });

  protected bad(name: 'username' | 'password' | 'companyId' | 'companyUrl'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty) && this.form.dirty;
  }

  protected lower(name: 'username' | 'companyId' | 'companyUrl'): void {
    const c = this.form.controls[name];
    let v = c.value.toLowerCase().trim();
    if (name === 'companyUrl') v = v.replace(/^(https?:\/\/)+(?=https?:\/\/)/, ''); // pasted full URL after the default prefix
    if (v !== c.value) c.setValue(v, { emitEvent: false });
  }

  /** Tabbing into the field selects everything – put the cursor after the default "https://" instead. */
  protected caretToEnd(e: Event): void {
    const el = e.target as HTMLInputElement;
    queueMicrotask(() => el.setSelectionRange(el.value.length, el.value.length));
  }

  /** Keeps the "https://" start: restores it when emptied and adds it when the user typed only the address. */
  protected fixUrl(): void {
    const c = this.form.controls.companyUrl;
    const v = c.value.trim();
    if (!v) c.setValue(URL_PREFIX);
    else if (!/^https?:\/\//.test(v)) c.setValue(URL_PREFIX + v);
  }

  protected async submit(): Promise<void> {
    this.error.set('');
    this.form.markAllAsTouched();
    this.form.markAsDirty();
    if (this.form.controls.companyUrl.hasError('pattern')) {
      this.error.set(this.t('Registration_InvalidUrl'));
      return;
    }
    if (this.form.invalid) {
      this.error.set(this.t('Registration_Required'));
      return;
    }
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      // BR-A1: user name, company ID and URL are stored lower-case (the defaults are shown as written).
      await this.auth.register({ ...v, username: v.username.trim().toLowerCase(), companyId: v.companyId.trim().toLowerCase(), companyUrl: v.companyUrl.trim().toLowerCase() });
      this.toast.success(this.t('Registration_Success'));
      await this.router.navigateByUrl('/pin');
    } catch (e) {
      const key = e instanceof Error ? e.message : '';
      this.error.set(this.t(key.startsWith('Registration_') ? key : 'Registration_Failed'));
    } finally {
      this.busy.set(false);
    }
  }
}

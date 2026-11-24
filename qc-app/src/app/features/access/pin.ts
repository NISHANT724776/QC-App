import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth/auth';
import { I18n } from '../../core/i18n/i18n';
import { Settings } from '../../core/settings/settings';
import { Toast } from '../../core/ui/toast';
import { Icon } from '../../shared/icon';
import { AuthLayout } from './auth-layout';

/**
 * PIN screen (A2). First launch after registration: Create PIN + Confirm PIN (4 digits, masked).
 * Later launches: PIN only (auto-submits on the 4th digit) or biometric (WebAuthn).
 */
@Component({
  selector: 'app-pin',
  imports: [ReactiveFormsModule, AuthLayout, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout [heading]="create() ? t('EnterPin_CreateTitle') : t('EnterPin_Title')">
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="stack">
          <label class="pill" [class.invalid]="!!error()">
            <app-icon name="lock" [size]="22" />
            <input type="password" inputmode="numeric" maxlength="4" autocomplete="off" formControlName="pin" [placeholder]="t('Profile_PinPlaceholder')" (input)="onPin()" aria-label="PIN" />
          </label>
          @if (create()) {
            <label class="pill" [class.invalid]="!!error()">
              <app-icon name="lock" [size]="22" />
              <input type="password" inputmode="numeric" maxlength="4" autocomplete="off" formControlName="confirm" [placeholder]="t('EnterPin_ConfirmPinPlaceholder')" (input)="digitsOnly('confirm')" aria-label="Confirm PIN" />
            </label>
          }
        </div>
        @if (error()) {
          <p class="err" role="alert">{{ error() }}</p>
        }
        <button class="go" type="submit" [disabled]="busy()" [attr.aria-label]="create() ? 'Create PIN' : 'Log in'"><app-icon name="arrowForward" [size]="30" /></button>
      </form>
      <div below class="below">
        <button type="button" class="bio-btn" (click)="biometric()"><app-icon name="fingerprint" [size]="22" /> {{ bioLabel() }}</button>
      </div>
    </app-auth-layout>
  `,
  styles: `
    .stack{display:grid;gap:14px}
    .err{color:var(--danger);text-align:center;margin:12px 0 0}
    .go{position:absolute;left:50%;bottom:-34px;transform:translateX(-50%);width:68px;height:68px;border-radius:50%;border:6px solid #fff;
      background:var(--grad);color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 2px 8px rgb(0 0 0 / 25%)}
    .go:disabled{opacity:.7}
    .below{display:flex;justify-content:center;margin-top:72px;min-height:44px}
    .bio,.bio-btn{display:inline-flex;align-items:center;gap:8px;color:var(--brand-dark);font-size:16px;background:none;border:0;cursor:pointer;min-height:44px}
  `,
})
export class PinPage {
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);
  private readonly settings = inject(Settings);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly t = inject(I18n).t;

  protected readonly create = signal(!this.auth.hasPin());
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly bioOn = computed(() => !!this.auth.registration()?.biometricCredentialId);
  protected readonly bioLabel = computed(() => (this.bioOn() && !this.create() ? this.t('EnterPin_UseBiometric') : this.t('EnterPin_EnableBiometric')));
  protected readonly form = this.fb.group({
    pin: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
    confirm: [''],
  });

  protected digitsOnly(name: 'pin' | 'confirm'): void {
    const c = this.form.controls[name];
    const v = c.value.replace(/\D/g, '').slice(0, 4);
    if (v !== c.value) c.setValue(v, { emitEvent: false });
  }

  protected onPin(): void {
    this.digitsOnly('pin');
    this.error.set('');
    if (!this.create() && this.form.controls.pin.value.length === 4) void this.submit();
  }

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    const { pin, confirm } = this.form.getRawValue();
    if (!/^\d{4}$/.test(pin)) {
      this.error.set(this.t('EnterPin_Invalid'));
      return;
    }
    this.busy.set(true);
    try {
      if (this.create()) {
        if (pin !== confirm) {
          this.error.set(this.t('EnterPin_Mismatch'));
          return;
        }
        await this.auth.createPin(pin);
      } else if (!(await this.auth.verifyPin(pin))) {
        this.error.set(this.t('EnterPin_Wrong'));
        this.form.controls.pin.reset('');
        return;
      }
      await this.router.navigateByUrl('/requests');
    } finally {
      this.busy.set(false);
    }
  }

  /** "Enable Touch/Face ID" (always visible, as in the source): enrols when the device supports it, or signs in when already enabled. */
  protected async biometric(): Promise<void> {
    if (!this.auth.biometricAvailable()) {
      this.toast.error(this.t('EnterPin_BiometricUnavailable'));
      return;
    }
    if (this.bioOn() && !this.create()) {
      if (await this.auth.biometricLogin()) await this.router.navigateByUrl('/requests');
      else this.toast.error(this.t('EnterPin_BiometricUnavailable'));
      return;
    }
    if (await this.auth.enableBiometric()) {
      this.settings.patch({ biometric: true });
      this.toast.success(this.t('EnterPin_BiometricEnabled'));
    } else {
      this.toast.error(this.t('EnterPin_BiometricUnavailable'));
    }
  }
}

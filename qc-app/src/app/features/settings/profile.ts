import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Auth } from '../../core/auth/auth';
import { LANGUAGES, LangCode } from '../../core/i18n/dictionaries';
import { I18n } from '../../core/i18n/i18n';
import { Settings } from '../../core/settings/settings';
import { Toast } from '../../core/ui/toast';
import { Confirm } from '../../shared/confirm';
import { Icon } from '../../shared/icon';
import { Option, SelectField } from '../../shared/select-field';
import { TopBar } from '../../shared/top-bar';
import { BugReportDialog, DiagnosticsDialog } from './profile-dialogs';

const URL_PATTERN = /^https?:\/\/[^\s/$.?#][^\s]*$/i;

/**
 * User profile (D1): toggles, language, company URL, PIN, Update, Unregister, diagnostics, bug report.
 * Web differences: settings apply immediately (no restart), "Landscape Layout" is automatic.
 */
@Component({
  selector: 'app-profile',
  imports: [ReactiveFormsModule, RouterLink, TopBar, Icon, SelectField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-top-bar [title]="t('Profile_Title')" [back]="true" (backClick)="back()" />
    <main class="page">
      <p class="who">{{ t('Profile_LoggedInAs') }} <strong>{{ auth.displayName() }}</strong></p>
      <form [formGroup]="form" (ngSubmit)="update()" novalidate>
        <ul class="toggles">
          <li>
            <label><app-icon name="bell" [size]="24" /><span>{{ t('Profile_Notification') }}</span>
              <input type="checkbox" role="switch" class="sw" formControlName="notification" /></label>
          </li>
          <li>
            <label><app-icon name="fingerprint" [size]="24" /><span>{{ t('Profile_Biometric') }}</span>
              <input type="checkbox" role="switch" class="sw" formControlName="biometric" [attr.disabled]="auth.biometricAvailable() ? null : ''" /></label>
          </li>
          <li>
            <label><app-icon name="image" [size]="24" /><span>{{ t('Profile_OptimizeImage') }}</span>
              <input type="checkbox" role="switch" class="sw" formControlName="optimizeImage" /></label>
          </li>
          <li>
            <label><app-icon name="tune" [size]="24" /><span>{{ t('Profile_LandscapeLayout') }}</span>
              <input type="checkbox" role="switch" class="sw" formControlName="landscapeLayout" /></label>
          </li>
        </ul>

        <div class="fields">
          <app-select-field [options]="languages" [value]="form.controls.language.value" (valueChange)="form.controls.language.setValue($any($event))" [title]="t('Profile_Language')" />
          <label class="pill" [class.invalid]="form.controls.companyUrl.invalid">
            <app-icon name="globe" [size]="22" />
            <input type="url" formControlName="companyUrl" [placeholder]="t('Profile_CompanyUrlPlaceholder')" autocapitalize="none" spellcheck="false" aria-label="Company URL" />
          </label>
          <label class="pill" [class.invalid]="form.controls.pin.invalid">
            <app-icon name="lock" [size]="22" />
            <input type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" formControlName="pin" [placeholder]="t('Profile_PinPlaceholder') + ' (••••)'" aria-label="PIN" />
          </label>
        </div>
        @if (form.invalid && form.dirty) {
          <p class="err" role="alert">{{ t(form.controls.pin.invalid ? 'EnterPin_Invalid' : 'Registration_InvalidUrl') }}</p>
        }
        <div class="btns">
          <button class="btn btn-primary" type="submit" [disabled]="busy()">{{ t('Profile_Update') }}</button>
          <button class="btn btn-danger" type="button" (click)="unregister()">{{ t('Profile_Unregister') }}</button>
        </div>
      </form>
      <nav class="links">
        @if (!embedded) {
          <a class="lnk" routerLink="/preview">Screen preview</a>
        }
        <button type="button" class="lnk" (click)="bug()">{{ t('Profile_ReportABug') }}</button>
        <button type="button" class="lnk" (click)="diagnostics()">{{ t('Profile_ShowSystemDiagnostics') }}</button>
        <span class="ver">v{{ version }}</span>
      </nav>
    </main>
  `,
  styles: `
    :host{display:block;min-height:100vh;background:var(--surface)}
    .page{max-width:720px;margin:0 auto;padding:12px 16px 32px}
    .who{text-align:center;margin:8px 0 16px;font-size:16px}
    .toggles{list-style:none;margin:0 0 16px;padding:0}
    .toggles li{border-bottom:1px solid var(--line)}
    .toggles label,.toggles .static{display:flex;align-items:center;gap:16px;min-height:56px;color:#555;font-size:16px}
    .toggles label span,.toggles .static span{flex:1}
    .static small{color:var(--muted);font-size:12px;text-align:right}
    .sw{appearance:none;width:44px;height:24px;border-radius:999px;background:#cfd6da;position:relative;cursor:pointer;flex:none;transition:background .15s;border:0}
    .sw::after{content:'';position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgb(0 0 0 / 30%);transition:transform .15s}
    .sw:checked{background:var(--brand)}.sw:checked::after{transform:translateX(20px)}
    .sw:disabled{opacity:.5;cursor:not-allowed}
    .fields{display:grid;gap:14px;margin:8px 0 16px}
    .err{color:var(--danger);margin:0 0 12px}
    .btns{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .links{display:grid;justify-items:center;gap:4px;margin-top:20px}
    .lnk{background:none;border:0;color:var(--brand-dark);text-decoration:underline;font-size:16px;cursor:pointer;min-height:44px;display:inline-flex;align-items:center}
    .ver{color:var(--muted);font-size:12px}
    @media (max-width:420px){.btns{grid-template-columns:1fr}}
  `,
})
export class ProfilePage implements OnInit {
  /** the preview tool shows the app inside a frame – no link to itself there */
  protected readonly embedded = window.self !== window.top;
  protected readonly auth = inject(Auth);
  private readonly settings = inject(Settings);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);
  private readonly confirm = inject(Confirm);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly t = inject(I18n).t;
  protected readonly version = environment.appVersion;
  protected readonly busy = signal(false);
  protected readonly languages: Option[] = LANGUAGES.map((l) => ({ id: l.code, label: l.label }));
  protected readonly canBio = computed(() => this.auth.biometricAvailable());

  protected readonly form = this.fb.group({
    notification: [this.settings.value().notification],
    biometric: [!!this.auth.registration()?.biometricCredentialId],
    optimizeImage: [this.settings.value().optimizeImage],
    landscapeLayout: [this.settings.value().landscapeLayout],
    language: [this.settings.value().language as LangCode],
    companyUrl: [this.auth.companyUrl(), [Validators.required, Validators.pattern(URL_PATTERN)]],
    pin: ['', Validators.pattern(/^(\d{4})?$/)],
  });

  ngOnInit(): void {
    this.form.controls.pin.valueChanges.subscribe((v) => {
      const d = v.replace(/\D/g, '').slice(0, 4);
      if (d !== v) this.form.controls.pin.setValue(d, { emitEvent: false });
    });
  }

  protected async update(): Promise<void> {
    this.form.markAllAsTouched();
    this.form.markAsDirty();
    if (this.form.invalid) return;
    const v0 = this.form.getRawValue();
    // As in the source app: changing layout or language needs a restart -> Info dialog (Cancel / Confirm)
    const needsRestart = v0.landscapeLayout !== this.settings.value().landscapeLayout || v0.language !== this.settings.value().language;
    if (needsRestart && !(await this.confirm.ask(this.t('Settings_Restart'), { title: this.t('Common_Info'), confirmLabel: this.t('Common_Confirm') }))) return;
    this.busy.set(true);
    try {
      const v = this.form.getRawValue();
      // Notification: ask the browser for permission when switched on
      let notification = v.notification;
      if (notification && 'Notification' in window && Notification.permission === 'default') {
        notification = (await Notification.requestPermission()) === 'granted';
      } else if (notification && 'Notification' in window && Notification.permission === 'denied') {
        notification = false;
      }
      if (notification !== v.notification) {
        this.toast.info(this.t('Profile_NotificationDenied'));
        this.form.controls.notification.setValue(notification);
      }
      // Biometric
      const hadBio = !!this.auth.registration()?.biometricCredentialId;
      let biometric = v.biometric;
      if (biometric && !hadBio) biometric = await this.auth.enableBiometric();
      else if (!biometric && hadBio) await this.auth.disableBiometric();
      this.form.controls.biometric.setValue(biometric);

      await this.auth.updateProfile(v.companyUrl, v.pin || null);
      this.settings.patch({ notification, biometric, optimizeImage: v.optimizeImage, landscapeLayout: v.landscapeLayout, language: v.language });
      this.form.controls.pin.reset('');
      if (needsRestart) {
        // "restart": reload the app so the chosen UI set / language is applied from scratch
        setTimeout(() => location.reload(), 150);
        return;
      }
      this.toast.success(this.t('Profile_Updated'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async unregister(): Promise<void> {
    if (!(await this.confirm.ask(this.t('Profile_UnregisterConfirm'), { danger: true, confirmLabel: this.t('Profile_Unregister') }))) return;
    await this.auth.unregister();
    await this.router.navigateByUrl('/register');
  }

  protected diagnostics(): void {
    this.dialog.open(DiagnosticsDialog, { maxWidth: '92vw', width: '460px' });
  }

  protected bug(): void {
    this.dialog.open(BugReportDialog, { maxWidth: '92vw', width: '460px' });
  }

  protected back(): void {
    void this.router.navigate(['/requests']);
  }
}

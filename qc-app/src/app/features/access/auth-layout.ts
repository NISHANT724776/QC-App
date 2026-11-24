import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18n } from '../../core/i18n/i18n';

/** Branded background + card shell shared by Registration and PIN (matches the source app's look). */
@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="wrap">
      <section class="hero" aria-hidden="false">
        <svg class="logo" viewBox="0 0 300 80" role="img" aria-label="WFX">
          <path d="M44 62a18 18 0 0 1-2-35.900A25 25 0 0 1 90 33a15 15 0 0 1-3 29z" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round" />
          <text x="104" y="62" font-size="58" font-weight="700" fill="#fff" font-family="Open Sans, Segoe UI, sans-serif" letter-spacing="-3">WFX</text>
        </svg>
        <p class="sub">{{ t('App_Subtitle') }}</p>
      </section>
      <section class="card-wrap">
        <div class="auth-card card">
          <h2>{{ heading() }}</h2>
          <ng-content />
        </div>
      </section>
      <ng-content select="[below]" />
      <footer>{{ t('App_Footer') }}</footer>
    </main>
  `,
  styles: `
    :host{display:block;min-height:100vh;background:#fff}
    .wrap{min-height:100vh;display:flex;flex-direction:column}
    .hero{height:42vh;min-height:240px;max-height:380px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:16px;color:#fff;
      background:
        radial-gradient(circle at 15% 25%,rgb(255 255 255 / 18%) 0 90px,transparent 91px),
        radial-gradient(circle at 80% 70%,rgb(60 80 150 / 35%) 0 120px,transparent 121px),
        radial-gradient(circle at 55% 15%,rgb(255 255 255 / 12%) 0 60px,transparent 61px),
        linear-gradient(135deg,#2fb5b7,#1e8fa8 55%,#2c7aa0)}
    .logo{width:170px;height:auto}
    .sub{margin:2px 0 0;font-size:22px;font-weight:300;letter-spacing:1px}
    .card-wrap{margin-top:-86px;padding:0 16px;display:flex;justify-content:center}
    .auth-card{width:100%;max-width:560px;padding:20px 24px 56px;position:relative;border-radius:14px;border:0;box-shadow:0 4px 14px rgb(0 0 0 / 20%)}
    h2{margin:0 0 16px;text-align:center;font-weight:300;font-size:30px;color:#555}
    footer{margin-top:auto;padding:24px 16px;text-align:center;color:var(--brand-dark);font-size:13px}
  `,
})
export class AuthLayout {
  readonly heading = input.required<string>();
  protected readonly t = inject(I18n).t;
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** "No Data Found!" empty state (illustration recreated as inline SVG). */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty" role="status">
      <svg viewBox="0 0 280 200" width="220" aria-hidden="true">
        <ellipse cx="140" cy="165" rx="110" ry="24" fill="#f1f3f4" />
        <g fill="#2d3a40"><path d="M40 60l30-18 30 18-30 18z" /><path d="M40 60v14l30 18V78zM100 60v14L70 92V78z" fill="#3c4c54" /></g>
        <path d="M40 76l30 18 30-18" stroke="#58e3c4" stroke-width="3" fill="none" />
        <path d="M40 98l30 18 30-18" stroke="#58e3c4" stroke-width="3" fill="none" />
        <rect x="90" y="52" width="110" height="78" rx="6" fill="#38494f" />
        <rect x="98" y="60" width="94" height="62" rx="3" fill="#fff" />
        <text x="145" y="96" text-anchor="middle" font-size="13" font-weight="700" fill="#58e3c4" font-family="Open Sans, sans-serif">NO DATA</text>
        <path d="M82 138h126l16 18H66z" fill="#7be8cf" />
        <circle cx="222" cy="96" r="12" fill="none" stroke="#58e3c4" stroke-width="4" />
        <path d="M231 105l14 14" stroke="#58e3c4" stroke-width="4" stroke-linecap="round" />
        <circle cx="248" cy="82" r="7" fill="#2d3a40" /><path d="M240 92h16v44h-16z" fill="#2d3a40" /><path d="M241 136h6v24h-6zM250 136h6v24h-6z" fill="#0b4a3d" />
      </svg>
      <p>{{ text() }}</p>
    </div>
  `,
  styles: `
    .empty{display:grid;justify-items:center;gap:8px;padding:48px 16px;color:#3d4a50}
    p{margin:0;font-size:24px;font-weight:700}
  `,
})
export class EmptyState {
  readonly text = input.required<string>();
}

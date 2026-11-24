import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Icon } from '../../shared/icon';

interface Device {
  id: string;
  label: string;
  w: number;
  h: number;
}

interface Screen {
  id: string;
  label: string;
  route: string;
  /** shown for viewing only (nothing can be submitted from the preview) */
  viewOnly?: boolean;
}

interface ScreenGroup {
  name: string;
  items: Screen[];
}

const DEVICES: Device[] = [
  { id: 'phone', label: 'Phone', w: 390, h: 844 },
  { id: 'phone-l', label: 'Phone ↔', w: 844, h: 390 },
  { id: 'tablet', label: 'Tablet', w: 820, h: 1180 },
  { id: 'tablet-l', label: 'Tablet ↔', w: 1180, h: 820 },
  { id: 'laptop', label: 'Laptop', w: 1366, h: 768 },
];

const R = '/requests/qr-7300/orders/qo-114081-b/inspect';

/** Every main screen of the app, grouped like the user flow (fixtures: IR-7300 for the result, IR-7299 for the report). */
const GROUPS: ScreenGroup[] = [
  {
    name: 'Sign in',
    items: [
      { id: 'register', label: 'Register', route: '/register', viewOnly: true },
      { id: 'pin', label: 'PIN', route: '/pin', viewOnly: true },
    ],
  },
  {
    name: 'Requests',
    items: [
      { id: 'active', label: 'Active requests', route: '/requests?tab=active' },
      { id: 'completed', label: 'Completed requests', route: '/requests?tab=completed' },
      { id: 'samples', label: 'Sample evaluations', route: '/requests?tab=active&kind=sample' },
    ],
  },
  {
    name: 'Create new',
    items: [
      { id: 'new-insp', label: 'New inspection', route: '/addons/inspection/new' },
      { id: 'new-sample', label: 'New sample evaluation', route: '/addons/sample-evaluation/new' },
    ],
  },
  {
    name: 'Inspection result (IR-7300)',
    items: [
      { id: 'r-summary', label: 'Summary page', route: `${R}/summary` },
      { id: 'r-ra', label: 'RA sheet', route: `${R}/ra-sheet` },
      { id: 'r-meas-eval', label: 'Measurement evaluation', route: `${R}/measurements` },
      { id: 'r-meas-res', label: 'Measurement results', route: `${R}/evaluation/eg-measurement` },
      { id: 'r-defects', label: 'Defect capturing', route: `${R}/defects` },
      { id: 'r-quality', label: 'Quality results', route: `${R}/evaluation/eg-quality` },
      { id: 'r-packing', label: 'Packing results', route: `${R}/evaluation/eg-packing` },
      { id: 'r-final', label: 'Final result', route: `${R}/final` },
    ],
  },
  {
    name: 'Other',
    items: [
      { id: 'report', label: 'Report (completed IR-7299)', route: '/requests/qr-7299/orders/qo-113950/report' },
      { id: 'profile', label: 'User profile', route: '/profile' },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);

/**
 * Screen preview: shows the real app inside a frame whose size you choose (phone / tablet / laptop / custom / full)
 * and lets you jump between its screens. The normal app flow is untouched – this is an extra view at /preview.
 */
@Component({
  selector: 'app-screen-preview',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.immersive]': 'immersive()', '(window:keydown.escape)': 'escape()' },
  template: `
    <header class="top">
      <button type="button" class="back" (click)="exit()" aria-label="Back to the app"><app-icon name="back" [size]="22" /></button>
      <h1>Screen preview</h1>
      <span class="path" [title]="path()">{{ path() || '…' }}</span>
      @if (viewOnly()) {
        <span class="vo" role="status">View only</span>
      }
      <a class="open" [href]="currentUrl()" target="_blank" rel="noopener">Open in new tab ↗</a>
    </header>

    <section class="controls" aria-label="Frame size">
      <div class="seg" role="radiogroup" aria-label="Device size">
        @for (d of devices; track d.id) {
          <button type="button" role="radio" [attr.aria-checked]="deviceId() === d.id" [class.on]="deviceId() === d.id" (click)="setDevice(d)">{{ d.label }}</button>
        }
        <button type="button" role="radio" [attr.aria-checked]="deviceId() === 'full'" [class.on]="deviceId() === 'full'" (click)="deviceId.set('full')">Full</button>
        <button type="button" role="radio" [attr.aria-checked]="deviceId() === 'custom'" [class.on]="deviceId() === 'custom'" (click)="deviceId.set('custom')">Custom</button>
      </div>
      <div class="size">
        <label>W <input type="number" min="240" max="3000" [value]="w()" [disabled]="deviceId() === 'full'" (change)="setSize('w', $any($event.target).value)" aria-label="Frame width" /></label>
        <label>H <input type="number" min="240" max="3000" [value]="h()" [disabled]="deviceId() === 'full'" (change)="setSize('h', $any($event.target).value)" aria-label="Frame height" /></label>
        <button type="button" class="rot" (click)="rotate()" [disabled]="deviceId() === 'full'" aria-label="Rotate frame" title="Rotate">⟳</button>
        <label class="fit"><input type="checkbox" [checked]="fit()" (change)="fit.set($any($event.target).checked)" [disabled]="deviceId() === 'full'" /> Fit to window</label>
        <span class="pct">{{ pct() }}%</span>
      </div>
      <button type="button" class="fs" (click)="toggleFullscreen()" aria-label="Full screen" title="Full screen (Esc to exit)">⛶ Full screen</button>
    </section>

    <!-- shown only in full screen: a slim bar to keep changing size / screen -->
    <div class="fsbar" role="toolbar" aria-label="Preview controls">
      <button type="button" (click)="toggleFullscreen()" aria-label="Exit full screen">✕ Exit</button>
      <select [value]="deviceId()" (change)="setDeviceId($any($event.target).value)" aria-label="Frame size">
        @for (d of devices; track d.id) {<option [value]="d.id" [selected]="deviceId() === d.id">{{ d.label }} {{ d.w }}×{{ d.h }}</option>}
        <option value="full" [selected]="deviceId() === 'full'">Full</option>
        <option value="custom" [selected]="deviceId() === 'custom'">Custom {{ w() }}×{{ h() }}</option>
      </select>
      <select [value]="screenId()" (change)="goId($any($event.target).value)" aria-label="Screen">
        @for (g of groups; track g.name) {
          <optgroup [label]="g.name">
            @for (s of g.items; track s.id) {<option [value]="s.id" [selected]="screenId() === s.id">{{ s.label }}</option>}
          </optgroup>
        }
      </select>
      <span class="pct">{{ pct() }}%</span>
    </div>

    <div class="body">
      <nav class="screens" aria-label="Screens">
        @for (g of groups; track g.name) {
          <h2>{{ g.name }}</h2>
          @for (s of g.items; track s.id) {
            <button type="button" [class.on]="screenId() === s.id" [attr.aria-current]="screenId() === s.id ? 'page' : null" (click)="go(s)">{{ s.label }}</button>
          }
        }
      </nav>
      <label class="screenpick">Screen
        <select [value]="screenId()" (change)="goId($any($event.target).value)" aria-label="Screen">
          @for (g of groups; track g.name) {
            <optgroup [label]="g.name">
              @for (s of g.items; track s.id) {<option [value]="s.id" [selected]="screenId() === s.id">{{ s.label }}</option>}
            </optgroup>
          }
        </select>
      </label>

      <div class="stage" #stage>
        <div class="holder" [style.width.px]="holderW()" [style.height.px]="holderH()">
          <div class="device" [class.bare]="deviceId() === 'full'" [style.width.px]="frameW()" [style.height.px]="frameH()" [style.transform]="'scale(' + scale() + ')'">
            <iframe #frame [src]="src()" title="App preview" allow="camera; clipboard-write"></iframe>
            @if (viewOnly()) {
              <div class="shield" title="View only – sign-in screens are shown without changing your login"></div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host{display:flex;flex-direction:column;height:100vh;background:#e9eef1;color:var(--text)}
    .top{display:flex;align-items:center;gap:12px;padding:8px 14px;color:#fff;background:linear-gradient(110deg,#3dbdca 0%,#27a8bd 45%,#3a8ca6 75%,#5b94ac 100%)}
    .top h1{margin:0;font-size:18px;font-weight:600;white-space:nowrap}
    .back{width:40px;height:40px;border:0;border-radius:50%;background:transparent;color:#fff;cursor:pointer;display:grid;place-items:center}
    .back:hover{background:rgb(255 255 255 / 20%)}
    .path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;opacity:.9;text-align:right}
    .open{color:#fff;font-size:13px;white-space:nowrap}
    .fs{margin-left:auto;min-height:36px;padding:0 14px;border:1px solid var(--brand);border-radius:8px;background:#fff;color:var(--brand-dark);font:inherit;font-weight:600;cursor:pointer}
    .fs:hover{background:var(--brand-soft)}
    .fsbar{display:none}
    :host(.immersive){background:#10171b}
    :host(.immersive) .top,:host(.immersive) .controls,:host(.immersive) .screens,:host(.immersive) .screenpick{display:none}
    :host(.immersive) .body{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr)}
    :host(.immersive) .stage{padding:60px 12px 12px}
    :host(.immersive) .fsbar{display:flex;position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:20;gap:8px;align-items:center;max-width:96vw;padding:6px 10px;border-radius:999px;background:rgb(255 255 255 / 94%);box-shadow:0 4px 16px rgb(0 0 0 / 40%)}
    .fsbar button{min-height:34px;padding:0 12px;border:0;border-radius:999px;background:var(--danger);color:#fff;font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
    .fsbar select{min-height:34px;max-width:40vw;border:1px solid var(--line-strong);border-radius:8px;font:inherit;font-size:13px;background:#fff}
    .fsbar .pct{font-size:13px}
    .vo{padding:2px 10px;border-radius:999px;background:rgb(255 255 255 / 25%);font-size:12px;font-weight:600;white-space:nowrap}
    .controls{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;padding:10px 14px;background:#fff;border-bottom:1px solid var(--line)}
    .seg{display:inline-flex;flex-wrap:wrap;background:#dfe3e5;border-radius:8px;padding:2px;gap:2px}
    .seg button{min-height:36px;padding:0 14px;border:0;border-radius:6px;background:transparent;font:inherit;font-size:14px;cursor:pointer;color:#4a575d}
    .seg button.on{background:#fff;color:var(--brand-dark);font-weight:600;box-shadow:0 1px 2px rgb(0 0 0 / 15%)}
    .size{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:13px;color:var(--muted)}
    .size input[type=number]{width:74px;min-height:34px;padding:0 6px;border:1px solid var(--line-strong);border-radius:6px;font:inherit}
    .rot{min-width:36px;min-height:34px;border:1px solid var(--line-strong);border-radius:6px;background:#fff;cursor:pointer;font-size:16px}
    .fit{display:inline-flex;gap:6px;align-items:center}.pct{font-weight:600;color:var(--brand-dark);min-width:44px}
    .body{flex:1;min-height:0;display:grid;grid-template-columns:230px minmax(0,1fr)}
    .screens{overflow:auto;padding:8px 8px 20px;background:#fff;border-right:1px solid var(--line)}
    .screens h2{margin:14px 8px 4px;font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:var(--muted)}
    .screens button{display:block;width:100%;min-height:38px;padding:0 12px;border:0;border-radius:8px;background:transparent;font:inherit;font-size:14px;text-align:left;cursor:pointer}
    .screens button:hover{background:var(--brand-soft)}
    .screens button.on{background:var(--brand);color:#fff;font-weight:600}
    .screenpick{display:none;grid-column:1/-1;padding:8px 14px;background:#fff;font-size:13px;color:var(--muted);gap:4px}
    .screenpick select{min-height:40px;border:1px solid var(--line-strong);border-radius:6px;font:inherit;background:#fff}
    .stage{overflow:auto;padding:14px;display:flex;justify-content:center;align-items:flex-start;min-width:0;min-height:0}
    .holder{flex:none}
    .device{transform-origin:top left;background:#fff;border:10px solid #1b1f23;border-radius:30px;box-shadow:0 10px 30px rgb(0 0 0 / 30%);overflow:hidden;box-sizing:content-box}
    .device.bare{border:0;border-radius:0;box-shadow:none}
    .device{position:relative}
    .shield{position:absolute;inset:0;cursor:not-allowed}
    iframe{display:block;width:100%;height:100%;border:0;background:#fff}
    @media (max-width:820px){
      .body{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}
      .screens{display:none}.screenpick{display:grid}
    }
  `,
})
export class ScreenPreviewPage implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly frame = viewChild.required<ElementRef<HTMLIFrameElement>>('frame');
  private observer?: ResizeObserver;
  private timer?: ReturnType<typeof setInterval>;

  protected readonly devices = DEVICES;
  protected readonly groups = GROUPS;
  protected readonly deviceId = signal('phone');
  protected readonly w = signal(390);
  protected readonly h = signal(844);
  protected readonly fit = signal(true);
  protected readonly screenId = signal('active');
  protected readonly immersive = signal(false);
  protected readonly path = signal('');
  private readonly stageW = signal(900);
  private readonly stageH = signal(700);

  private readonly bezel = computed(() => (this.deviceId() === 'full' ? 0 : 20));
  protected readonly frameW = computed(() => (this.deviceId() === 'full' ? this.stageW() - 28 : this.w()));
  protected readonly frameH = computed(() => (this.deviceId() === 'full' ? this.stageH() - 28 : this.h()));
  protected readonly scale = computed(() => {
    if (this.deviceId() === 'full' || !this.fit()) return 1;
    const sw = (this.stageW() - 28) / (this.frameW() + this.bezel());
    const sh = (this.stageH() - 28) / (this.frameH() + this.bezel());
    return Math.max(0.2, Math.min(1, sw, sh));
  });
  protected readonly pct = computed(() => Math.round(this.scale() * 100));
  protected readonly holderW = computed(() => (this.frameW() + this.bezel()) * this.scale());
  protected readonly holderH = computed(() => (this.frameH() + this.bezel()) * this.scale());

  protected readonly viewOnly = computed(() => !!ALL.find((s) => s.id === this.screenId())?.viewOnly);
  private readonly route = signal(ALL.find((s) => s.id === 'active')!.route);
  protected readonly src = computed(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.route()));
  protected readonly currentUrl = computed(() => location.origin + (this.path() || this.route()));

  ngOnInit(): void {
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    const el = this.stage().nativeElement;
    this.observer = new ResizeObserver(() => {
      this.stageW.set(el.clientWidth);
      this.stageH.set(el.clientHeight);
    });
    this.observer.observe(el);
    // follow navigation done inside the frame (same origin) so the screen list and path stay in sync
    this.timer = setInterval(() => this.syncPath(), 500);
  }

  ngOnDestroy(): void {
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    this.observer?.disconnect();
    clearInterval(this.timer);
  }

  private syncPath(): void {
    try {
      const loc = this.frame().nativeElement.contentWindow?.location;
      if (!loc || loc.href === 'about:blank') return;
      const p = loc.pathname + loc.search;
      if (p === this.path()) return;
      this.path.set(p);
      const hit = ALL.find((s) => s.route === p) ?? ALL.find((s) => s.route.split('?')[0] === loc.pathname && p.startsWith(s.route.split('?')[0]));
      this.screenId.set(hit?.id ?? '');
    } catch {
      /* cross-origin page (should not happen) */
    }
  }

  /** Full screen: the browser goes full screen (where supported) and the toolbars collapse into a slim floating bar. */
  protected toggleFullscreen(): void {
    if (this.immersive()) {
      this.immersive.set(false);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      return;
    }
    this.immersive.set(true);
    void document.documentElement.requestFullscreen?.().catch(() => undefined); // still works as a "hide toolbars" mode where full screen is blocked (e.g. iPhone Safari)
  }

  protected escape(): void {
    if (this.immersive() && !document.fullscreenElement) this.immersive.set(false);
  }

  private readonly onFullscreenChange = (): void => {
    if (!document.fullscreenElement && this.immersive()) this.immersive.set(false);
  };

  protected setDeviceId(id: string): void {
    const d = DEVICES.find((x) => x.id === id);
    if (d) this.setDevice(d);
    else this.deviceId.set(id);
  }

  protected setDevice(d: Device): void {
    this.deviceId.set(d.id);
    this.w.set(d.w);
    this.h.set(d.h);
  }

  protected setSize(which: 'w' | 'h', raw: string): void {
    const v = Math.min(3000, Math.max(240, Math.round(+raw) || 240));
    (which === 'w' ? this.w : this.h).set(v);
    this.deviceId.set('custom');
  }

  protected rotate(): void {
    const w = this.w();
    this.w.set(this.h());
    this.h.set(w);
    this.deviceId.set('custom');
  }

  protected go(s: Screen): void {
    this.screenId.set(s.id);
    this.route.set(s.route);
    this.path.set(s.route);
  }

  protected goId(id: string): void {
    const s = ALL.find((x) => x.id === id);
    if (s) this.go(s);
  }

  protected exit(): void {
    void this.router.navigate(['/requests']);
  }
}

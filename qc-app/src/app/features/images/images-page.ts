import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18n } from '../../core/i18n/i18n';
import { FormStore } from '../../core/sync/form-store';
import { RequestsStore } from '../../core/sync/requests-store';
import { Sync } from '../../core/sync/sync';
import { Network } from '../../core/ui/network';
import { Toast } from '../../core/ui/toast';
import { PhotoEntry, photoEntries } from '../../domain/rules/photos';
import { Icon } from '../../shared/icon';
import { TopBar } from '../../shared/top-bar';

interface OrderImages {
  key: string;
  requestId: string;
  orderId: string;
  title: string;
  subtitle: string;
  submitted: boolean;
  entries: PhotoEntry[];
}

type Filter = 'all' | 'pending' | 'uploaded';

/**
 * Images page (opened from the floating image button on the request list): every photo attached in saved
 * drafts and submitted results, grouped by request / order, with its upload status (pending = in the upload queue).
 */
@Component({
  selector: 'app-images',
  imports: [TopBar, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-top-bar [title]="t('Images_Title')" [back]="true" (backClick)="back()" />
    <main class="page">
      <section class="summary" aria-live="polite">
        <div class="stat"><b>{{ total() }}</b><span>{{ t('Images_Total') }}</span></div>
        <div class="stat warn"><b>{{ pending() }}</b><span>{{ t('Images_Pending') }}</span></div>
        <div class="stat ok"><b>{{ total() - pending() }}</b><span>{{ t('Images_Uploaded') }}</span></div>
        <button type="button" class="btn btn-primary upl" (click)="syncNow()" [disabled]="!pending() || sync.syncing() || !network.online()">
          <app-icon name="sync" [size]="20" [class.spin]="sync.syncing()" /> {{ t('Images_UploadNow') }}
        </button>
      </section>

      <div class="chips" role="radiogroup" [attr.aria-label]="t('Images_Title')">
        @for (f of filters; track f.id) {
          <button type="button" role="radio" class="chip" [attr.aria-checked]="filter() === f.id" [class.on]="filter() === f.id" (click)="filter.set(f.id)">{{ t(f.label) }}</button>
        }
      </div>

      @if (!network.online()) {
        <p class="offline" role="status"><app-icon name="warning" [size]="18" /> {{ t('Common_Offline') }}</p>
      }

      @if (loading()) {
        <p class="empty" role="status">{{ t('Common_Loading') }}</p>
      } @else {
        @for (g of groups(); track g.key) {
          <section class="group">
            <header>
              <div><h2>{{ g.title }}</h2><p>{{ g.subtitle }}</p></div>
              <span class="tag" [class.sub]="g.submitted">{{ g.submitted ? t('Images_Submitted') : t('Images_Draft') }}</span>
            </header>
            <div class="grid">
              @for (e of g.entries; track e.photo.id) {
                <button type="button" class="card" (click)="open(e)" [attr.aria-label]="e.photo.name + ' – ' + e.source">
                  <span class="thumb"><img [src]="e.photo.dataUrl" [alt]="e.photo.name" loading="lazy" /></span>
                  <span class="nm">{{ e.photo.name }}</span>
                  <span class="src">{{ e.source }}</span>
                  <span class="st" [class.p]="!e.photo.uploaded">{{ e.photo.uploaded ? t('Images_Uploaded') : t('Images_WaitingUpload') }}</span>
                </button>
              }
            </div>
            <button type="button" class="go" (click)="openOrder(g)">{{ t('Images_OpenResult') }} ›</button>
          </section>
        } @empty {
          <div class="empty">
            <app-icon name="image" [size]="56" />
            <p>{{ total() ? t('Images_NoneInFilter') : t('Images_None') }}</p>
            <small>{{ t('Images_Hint') }}</small>
          </div>
        }
      }
    </main>

    @if (viewing(); as v) {
      <div class="lightbox" role="dialog" aria-modal="true" [attr.aria-label]="v.photo.name" (click)="viewing.set(null)" (keydown.escape)="viewing.set(null)" tabindex="-1">
        <button type="button" class="x" (click)="viewing.set(null)" [attr.aria-label]="t('Common_Cancel')">✕</button>
        <img [src]="v.photo.dataUrl" [alt]="v.photo.name" (click)="$event.stopPropagation()" />
        <p (click)="$event.stopPropagation()"><b>{{ v.photo.name }}</b><br />{{ v.source }} · {{ v.photo.uploaded ? t('Images_Uploaded') : t('Images_WaitingUpload') }}@if (v.photo.comment) { <br />{{ v.photo.comment }} }</p>
      </div>
    }
  `,
  styles: `
    :host{display:flex;flex-direction:column;min-height:100vh;background:var(--surface)}
    .page{flex:1;width:100%;max-width:1180px;margin:0 auto;padding:12px 16px 40px}
    .summary{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:6px 0 10px}
    .stat{display:grid;min-width:96px;padding:10px 16px;border:1px solid var(--line);border-radius:12px;background:#fff;text-align:center}
    .stat b{font-size:24px;line-height:1.1}.stat span{font-size:12px;color:var(--muted)}
    .stat.warn b{color:#c47a00}.stat.ok b{color:var(--ok)}
    .upl{margin-left:auto;min-height:46px}
    .spin{animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}
    .chips{display:flex;flex-wrap:wrap;gap:8px;padding:2px 0 10px}
    .chip{min-height:36px;padding:0 16px;border:1px solid var(--line-strong);border-radius:999px;background:#fff;font:inherit;font-size:14px;color:#4a575d;cursor:pointer}
    .chip.on{background:var(--brand);border-color:var(--brand);color:#fff}
    .offline{display:flex;gap:6px;align-items:center;color:#9a5b00;background:#fff4e0;padding:8px 12px;border-radius:6px;font-size:14px}
    .group{margin:14px 0;border:1px solid var(--line);border-radius:14px;background:#fff;overflow:hidden}
    .group header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:12px 16px;background:#f4f8fa;border-bottom:1px solid var(--line)}
    .group h2{margin:0;font-size:16px;font-weight:600}.group header p{margin:2px 0 0;font-size:13px;color:var(--muted)}
    .tag{padding:2px 10px;border-radius:999px;background:#fff4e0;color:#9a5b00;font-size:12px;font-weight:600;white-space:nowrap}.tag.sub{background:#e6f4ea;color:#17603a}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:14px 16px}
    .card{display:grid;gap:3px;align-content:start;padding:8px;border:1px solid var(--line);border-radius:10px;background:#fff;font:inherit;text-align:left;cursor:pointer}
    .card:hover,.card:focus-visible{border-color:var(--brand);box-shadow:0 2px 8px rgb(0 0 0 / 12%);outline:0}
    .thumb{display:grid;place-items:center;aspect-ratio:1;border-radius:8px;background:#eef2f4;overflow:hidden}
    .thumb img{width:100%;height:100%;object-fit:cover}
    .nm{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .src{font-size:12px;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .st{font-size:12px;font-weight:600;color:var(--ok)}.st.p{color:#c47a00}
    .go{display:block;width:100%;min-height:44px;border:0;border-top:1px solid var(--line);background:#fff;color:var(--brand-dark);font:inherit;font-weight:600;cursor:pointer;text-align:right;padding:0 16px}
    .go:hover{background:var(--brand-soft)}
    .empty{display:grid;justify-items:center;gap:6px;padding:48px 16px;text-align:center;color:var(--muted)}
    .empty p{margin:6px 0 0;font-size:17px;color:var(--text)}
    .lightbox{position:fixed;inset:0;z-index:50;display:grid;place-items:center;align-content:center;gap:10px;padding:16px;background:rgb(0 0 0 / 82%);color:#fff;outline:0}
    .lightbox img{max-width:min(94vw,900px);max-height:74vh;object-fit:contain;border-radius:8px;background:#fff}
    .lightbox p{margin:0;text-align:center;font-size:14px}
    .x{position:absolute;top:12px;right:12px;width:44px;height:44px;border:0;border-radius:50%;background:rgb(255 255 255 / 20%);color:#fff;font-size:20px;cursor:pointer}
  `,
})
export class ImagesPage implements OnInit {
  private readonly forms = inject(FormStore);
  private readonly requests = inject(RequestsStore);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);
  protected readonly sync = inject(Sync);
  protected readonly network = inject(Network);
  protected readonly t = inject(I18n).t;

  protected readonly filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Images_All' },
    { id: 'pending', label: 'Images_Pending' },
    { id: 'uploaded', label: 'Images_Uploaded' },
  ];
  protected readonly filter = signal<Filter>('all');
  protected readonly loading = signal(true);
  protected readonly viewing = signal<PhotoEntry | null>(null);
  private readonly all = signal<OrderImages[]>([]);

  protected readonly total = computed(() => this.all().reduce((n, g) => n + g.entries.length, 0));
  protected readonly pending = computed(() => this.all().reduce((n, g) => n + g.entries.filter((e) => !e.photo.uploaded).length, 0));
  protected readonly groups = computed(() => {
    const f = this.filter();
    return this.all()
      .map((g) => ({ ...g, entries: g.entries.filter((e) => f === 'all' || (f === 'pending' ? !e.photo.uploaded : e.photo.uploaded)) }))
      .filter((g) => g.entries.length);
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    await this.requests.ensureLoaded();
    const saved = await this.forms.savedForms();
    const groups: OrderImages[] = [];
    for (const f of saved) {
      const entries = photoEntries(f);
      if (!entries.length) continue;
      const req = this.requests.find(f.requestId);
      const order = req?.orders.find((o) => o.qaRequestOrderId === f.orderId);
      groups.push({
        key: f.orderId,
        requestId: f.requestId,
        orderId: f.orderId,
        title: `${req?.tranNum ?? f.tranNum}${order ? ' · ' + this.t('Request_OrderNo') + ' ' + order.orderRefNo : ''}`,
        subtitle: [req?.articleName, order?.styleName].filter(Boolean).join(' · '),
        submitted: f.status === 'submitted',
        entries,
      });
    }
    this.all.set(groups.sort((a, b) => a.title.localeCompare(b.title)));
    await this.forms.refreshPending();
    this.loading.set(false);
  }

  protected open(e: PhotoEntry): void {
    this.viewing.set(e);
  }

  protected openOrder(g: OrderImages): void {
    void this.router.navigate(['/requests', g.requestId, 'orders', g.orderId, g.submitted ? 'report' : 'inspect']);
  }

  protected async syncNow(): Promise<void> {
    try {
      await this.sync.run();
      await this.load();
      this.toast.success(this.t('Request_SyncDone'));
    } catch {
      this.toast.error(this.t('Request_SyncFailed'));
    }
  }

  protected back(): void {
    void this.router.navigate(['/requests']);
  }
}

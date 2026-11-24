import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, firstValueFrom } from 'rxjs';
import { NewChoice, NewMenuDialog } from '../addons/new-menu-dialog';
import { environment } from '../../../environments/environment';
import { I18n } from '../../core/i18n/i18n';
import { Settings } from '../../core/settings/settings';
import { FormStore } from '../../core/sync/form-store';
import { RequestsStore } from '../../core/sync/requests-store';
import { Sync } from '../../core/sync/sync';
import { Network } from '../../core/ui/network';
import { Toast } from '../../core/ui/toast';
import { InspectionRepository } from '../../data/repositories';
import { InspectionRequest, OrderLine, RequestAttachment, RequestKind, RequestTab } from '../../domain/models/request';
import { CalendarPicker } from '../../shared/calendar-dialog';
import { Confirm } from '../../shared/confirm';
import { RangeMode, pad, fromIso, rangeFor, shiftAnchor, toIso } from '../../shared/date-utils';
import { EmptyState } from '../../shared/empty-state';
import { Icon } from '../../shared/icon';
import { Segmented } from '../../shared/segmented';
import { Option } from '../../shared/select-field';
import { TopBar } from '../../shared/top-bar';
import { RequestCard } from './request-card';

const PAGE_SIZE = 20;

/**
 * Request list. Two UI sets, like the source app (Profile > Landscape Layout):
 *  - portrait: Active | Completed tabs, search, calendar icon
 *  - landscape: < range > with Day | Week | Month, search, calendar, ⋮ menu (View Active / Completed Requests)
 * Both: date-grouped cards, Sync bar, "Last Sync", version, pending-upload badge.
 */
@Component({
  selector: 'app-request-list',
  imports: [DatePipe, TopBar, RequestCard, EmptyState, Icon, Segmented, MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-top-bar [title]="t('Request_Title')" />

    @if (!landscape()) {
      <div class="tabs" role="tablist">
        <button role="tab" [attr.aria-selected]="tab() === 'active'" [class.on]="tab() === 'active'" (click)="setTab('active')">{{ t('Request_ActiveTab') }}</button>
        <button role="tab" [attr.aria-selected]="tab() === 'completed'" [class.on]="tab() === 'completed'" (click)="setTab('completed')">{{ t('Request_CompletedTab') }}</button>
      </div>
      <section class="filters">
        <label class="search">
          <app-icon name="search" />
          <input type="search" [value]="searchText()" [placeholder]="t('Request_SearchPlaceholder')" [attr.aria-label]="t('Request_SearchPlaceholder')" (input)="onSearch($any($event.target).value)" />
        </label>
        <button type="button" class="ic cal" (click)="openCalendar()" [attr.aria-label]="t('Request_Calendar')" [title]="t('Request_Calendar')"><app-icon name="calendar" [size]="32" /></button>
      </section>
      @if (mode() === 'day') {
        <div class="chiprow"><span class="chip">{{ rangeLabel() }}<button type="button" (click)="setMode('all')" [attr.aria-label]="t('Request_ClearDate')"><app-icon name="close" [size]="16" /></button></span></div>
      }
    } @else {
      <section class="lsbar">
        <div class="nav">
          <button type="button" class="ic arrow" (click)="shift(-1)" aria-label="Previous"><app-icon name="chevronLeft" [size]="28" /></button>
          <span class="rl">{{ rangeLabel() }}</span>
          <button type="button" class="ic arrow" (click)="shift(1)" aria-label="Next"><app-icon name="chevronRight" [size]="28" /></button>
        </div>
        <app-segmented class="seg" [options]="rangeOptions()" [value]="mode()" (valueChange)="setMode($any($event))" [label]="t('Request_Calendar')" />
        <label class="search ls">
          <app-icon name="search" />
          <input type="search" [value]="searchText()" [placeholder]="t('Request_SearchPlaceholder')" [attr.aria-label]="t('Request_SearchPlaceholder')" (input)="onSearch($any($event.target).value)" />
        </label>
        <button type="button" class="ic cal" (click)="openCalendar()" [attr.aria-label]="t('Request_Calendar')" [title]="t('Request_Calendar')"><app-icon name="calendar" [size]="32" /></button>
        <button type="button" class="ic" [matMenuTriggerFor]="menu" aria-label="More"><app-icon name="more" [size]="28" /></button>
        <mat-menu #menu="matMenu" xPosition="before">
          <button mat-menu-item class="mi" [class.cur]="tab() === 'active'" (click)="setTab('active')">{{ t('Request_ViewActive') }}</button>
          <button mat-menu-item class="mi" [class.cur]="tab() === 'completed'" (click)="setTab('completed')">{{ t('Request_ViewCompleted') }}</button>
        </mat-menu>
      </section>
    }

    @if (!network.online()) {
      <p class="offline" role="status"><app-icon name="warning" [size]="18" /> {{ t('Common_Offline') }}</p>
    }

    <main class="list" aria-live="polite">
      @for (g of groups(); track g.date) {
        <h2 class="date">{{ g.date | date: 'MMM dd y' }}</h2>
        @for (r of g.items; track r.qaRequestId) {
          <app-request-card [request]="r" [landscape]="landscape()" (open)="openOrder(r, $event)" (report)="openReport(r, $event)" (cancel)="cancelRequest(r)" (attachment)="openAttachment($event)" (syncNow)="runSync()" />
        }
      } @empty {
        <app-empty-state [text]="t('Common_NoData')" />
      }
      @if (page().items.length < page().total) {
        <button class="btn btn-outline more" (click)="more()">{{ t('Request_LoadMore') }}</button>
      }
    </main>

    <footer class="syncbar">
      <button class="btn btn-primary sync" (click)="runSync()" [disabled]="sync.syncing()">
        <app-icon name="sync" [size]="22" [class.spin]="sync.syncing()" /> {{ t('Request_Sync') }}
      </button>
      <div class="meta">
        <span class="last">{{ t('Request_LastSync') }} {{ sync.lastSync() ? (sync.lastSync() | date: 'dd/MM/yyyy hh:mm a') : t('Request_NeverSynced') }}</span>
        <span class="ver">v{{ version }}</span>
      </div>
    </footer>

    <div class="fabs">
      <button type="button" class="fab" (click)="openNew()" aria-haspopup="dialog" [attr.aria-label]="t('New_Title')">
        <app-icon name="add" [size]="26" /><span>{{ t('New_Button') }}</span>
      </button>
      <button type="button" class="queue" (click)="openImages()" [title]="t('Request_PendingUploads')" [attr.aria-label]="t('Request_PendingUploads') + ': ' + forms.pendingUploads()">
        <app-icon name="image" [size]="26" /><span class="n">{{ forms.pendingUploads() }}</span>
      </button>
    </div>
  `,
  styles: `
    :host{display:flex;flex-direction:column;min-height:100vh;padding-bottom:104px;background:var(--surface)}
    .tabs{display:grid;grid-template-columns:1fr 1fr;background:#f5f5f5}
    .tabs button{min-height:50px;border:0;border-bottom:3px solid transparent;background:transparent;font:inherit;font-size:16px;color:#6b7a82;cursor:pointer}
    .tabs button.on{color:var(--brand);border-bottom-color:var(--brand)}
    .filters{display:flex;gap:12px;align-items:center;padding:10px 16px}
    .search{flex:1;min-width:0;display:flex;align-items:center;gap:12px;min-height:46px;padding:0 24px;border:1px solid var(--line-strong);border-radius:4px;color:#666;background:#fff}
    .search:focus-within{border-color:var(--brand)}
    .search input{flex:1;min-width:0;border:0;outline:0;font-size:16px;background:transparent;color:var(--text);min-height:40px}
    .ic{display:grid;place-items:center;width:48px;height:48px;border:0;background:transparent;border-radius:50%;cursor:pointer;color:var(--brand);flex:none}
    .ic:hover,.ic:focus-visible{background:var(--brand-soft)}
    .cal{color:#37474f}
    .chiprow{padding:0 16px 4px}
    .chip{display:inline-flex;align-items:center;gap:4px;padding:2px 4px 2px 12px;border-radius:999px;background:var(--brand-soft);color:var(--brand-dark);font-size:13px}
    .chip button{border:0;background:transparent;color:inherit;cursor:pointer;display:grid;place-items:center;width:28px;height:28px;border-radius:50%}
    .lsbar{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;padding:6px 12px;background:#f2f2f2}
    .nav{display:flex;align-items:center}
    .rl{min-width:170px;text-align:center;font-size:14px;color:#111}
    .arrow{color:var(--brand)}
    .seg{flex:none}
    .search.ls{flex:0 1 300px;min-height:40px;padding:0 12px;margin-left:auto;gap:8px}
    .search.ls input{min-height:36px;font-size:14px}
    .offline{display:flex;align-items:center;gap:8px;margin:0;padding:8px 16px;background:#fff4d6;color:#7a5b00;font-size:13px}
    .list{flex:1;width:100%;margin:0 auto;padding:0 16px 16px;display:grid;gap:12px;align-content:start}
    .date{margin:8px 0 0;font-size:20px;font-weight:400;color:var(--brand)}
    .more{justify-self:center}
    .syncbar{position:fixed;left:0;right:0;bottom:0;padding:8px 12px calc(6px + env(safe-area-inset-bottom));background:#fff;z-index:5}
    .sync{width:100%;display:flex;min-height:50px;font-size:18px;font-weight:400}
    .fab{display:inline-flex;align-items:center;gap:8px;min-height:56px;padding:0 22px 0 16px;border:0;border-radius:28px;
      background:var(--grad,linear-gradient(110deg,#3dbdca,#2a73ab));color:#fff;font:inherit;font-size:17px;font-weight:600;cursor:pointer;box-shadow:0 6px 16px rgb(0 0 0 / 28%),0 2px 4px rgb(0 0 0 / 20%);transition:transform .15s,box-shadow .15s}
    .fab:hover,.fab:focus-visible{transform:translateY(-2px);box-shadow:0 10px 22px rgb(0 0 0 / 32%);outline:0}
    .fab:active{transform:scale(.97)}
    .meta{margin:2px auto 0;display:flex;justify-content:space-between;font-size:12px;position:relative}
    .last{color:var(--brand);font-weight:700;flex:1;text-align:center}
    .ver{color:var(--muted);position:absolute;right:0}
    .fabs{position:fixed;right:16px;bottom:calc(96px + env(safe-area-inset-bottom));z-index:6;display:flex;flex-direction:column;align-items:flex-end;gap:14px;pointer-events:none}
    .fabs>*{pointer-events:auto}
    .queue{position:relative;width:56px;height:56px;border:0;border-radius:50%;background:#17b8c8;color:#fff;cursor:pointer;display:grid;place-items:center;box-shadow:0 6px 16px rgb(0 0 0 / 28%),0 2px 4px rgb(0 0 0 / 20%);transition:transform .15s,box-shadow .15s}
    .queue:hover,.queue:focus-visible{transform:translateY(-2px);box-shadow:0 10px 22px rgb(0 0 0 / 32%);outline:0}
    .queue .n{position:absolute;top:-4px;right:-4px;min-width:22px;height:22px;border-radius:999px;background:#fff;color:#333;font-size:12px;font-weight:600;display:grid;place-items:center;border:1px solid var(--line-strong)}
    .spin{animation:s 1s linear infinite}
    @keyframes s{to{transform:rotate(360deg)}}
    ::ng-deep .mi.cur{color:var(--brand)}
  `,
})
export class RequestListPage implements OnInit {
  protected readonly store = inject(RequestsStore);
  protected readonly sync = inject(Sync);
  protected readonly forms = inject(FormStore);
  protected readonly network = inject(Network);
  private readonly repo = inject(InspectionRepository);
  private readonly router = inject(Router);
  private readonly toast = inject(Toast);
  private readonly confirm = inject(Confirm);
  private readonly calendar = inject(CalendarPicker);
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;
  protected readonly landscape = inject(Settings).landscape;
  protected readonly version = environment.appVersion;

  /** Deep links / refresh: /requests?tab=completed&kind=sample */
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });
  readonly kindParam = input<string | undefined>(undefined, { alias: 'kind' });
  protected readonly tab = signal<RequestTab>('active');
  protected readonly kind = signal<'all' | RequestKind>('all');
  protected readonly kindFilter = computed<RequestKind | undefined>(() => {
    const k = this.kind();
    return k === 'all' ? undefined : k;
  });
  /** portrait: 'all' (or 'day' after picking a date); landscape: day | week | month (default week) */
  protected readonly mode = signal<RangeMode>(this.landscape() ? 'week' : 'all');
  protected readonly anchor = signal(toIso(new Date()));
  protected readonly searchText = signal('');
  private readonly pages = signal(1);

  private readonly search$ = new Subject<string>();
  protected readonly search = toSignal(this.search$.pipe(debounceTime(300), distinctUntilChanged()), { initialValue: '' });

  protected readonly rangeOptions = computed<Option[]>(() => [
    { id: 'day', label: this.t('Request_Day') },
    { id: 'week', label: this.t('Request_Week') },
    { id: 'month', label: this.t('Request_Month') },
  ]);

  protected readonly range = computed(() => rangeFor(this.mode(), this.anchor()));
  protected readonly rangeLabel = computed(() => {
    const { from, to } = this.range();
    const fmt = (iso: string) => {
      const d = fromIso(iso);
      return `${d.toLocaleDateString(this.i18n.lang(), { month: 'short' })} ${pad(d.getDate())} ${d.getFullYear()}`;
    };
    return from && to ? (from === to ? fmt(from) : `${fmt(from)}  -  ${fmt(to)}`) : '';
  });

  protected readonly page = computed(() =>
    this.store.query({ tab: this.tab(), kind: this.kindFilter(), search: this.search(), from: this.range().from, to: this.range().to, page: this.pages(), pageSize: PAGE_SIZE }),
  );

  protected readonly groups = computed(() => {
    const out: { date: string; items: InspectionRequest[] }[] = [];
    for (const r of this.page().items) {
      const last = out[out.length - 1];
      if (last && last.date === r.date) last.items.push(r);
      else out.push({ date: r.date, items: [r] });
    }
    return out;
  });

  constructor() {
    this.search$.pipe(takeUntilDestroyed()).subscribe(() => this.pages.set(1));
    effect(() => {
      const t = this.tabParam();
      const k = this.kindParam();
      if (t === 'active' || t === 'completed') this.tab.set(t);
      this.kind.set(k === 'inspection' || k === 'sample' ? k : 'all');
      this.pages.set(1);
    });
  }

  async ngOnInit(): Promise<void> {
    await this.store.ensureLoaded();
    await this.forms.refreshPending();
    if (this.store.isEmpty && navigator.onLine) await this.runSync(true);
  }

  protected setTab(t: RequestTab): void {
    this.tab.set(t);
    this.pages.set(1);
    this.syncUrl();
  }

  /** Keep ?tab=&kind= in the address bar so a refresh / shared link reopens the same view. */
  private syncUrl(): void {
    void this.router.navigate([], { queryParams: { tab: this.tab(), kind: this.kind() === 'all' ? null : this.kind() }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected setMode(m: RangeMode): void {
    this.mode.set(m);
    this.pages.set(1);
  }

  protected shift(dir: 1 | -1): void {
    this.anchor.set(shiftAnchor(this.mode(), this.anchor(), dir));
    this.pages.set(1);
  }

  protected onSearch(v: string): void {
    this.searchText.set(v);
    this.search$.next(v);
  }

  protected more(): void {
    this.pages.update((p) => p + 1);
  }

  protected async openCalendar(): Promise<void> {
    const res = await this.calendar.pick(this.mode() === 'all' ? null : this.anchor(), this.page().datesWithRequests, false);
    if (!res || !('date' in res)) return;
    this.anchor.set(res.date);
    if (!this.landscape()) this.setMode('day'); // portrait: the picked date becomes the filter
    this.pages.set(1);
  }

  protected openOrder(r: InspectionRequest, o: OrderLine): void {
    void this.router.navigate(['/requests', r.qaRequestId, 'orders', o.qaRequestOrderId, 'inspect']);
  }

  protected openReport(r: InspectionRequest, o: OrderLine): void {
    void this.router.navigate(['/requests', r.qaRequestId, 'orders', o.qaRequestOrderId, 'report']);
  }

  protected async cancelRequest(r: InspectionRequest): Promise<void> {
    if (!(await this.confirm.ask(this.t('Request_CancelConfirm'), { danger: true, confirmLabel: this.t('Request_Cancel') }))) return;
    try {
      await this.repo.cancelRequest(r.qaRequestId);
      await this.store.remove(r.qaRequestId);
      this.toast.success(this.t('Request_Cancelled'));
    } catch {
      this.toast.error(this.t('Msg_NoInternetConnection'));
    }
  }

  protected async openAttachment(a: RequestAttachment): Promise<void> {
    try {
      const blob = await this.repo.fetchAttachment(a.fileUrl, a.userFileName);
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    } catch {
      this.toast.error(this.t('Msg_NoInternetConnection'));
    }
  }

  protected openImages(): void {
    void this.router.navigate(['/images']);
  }

  /** "New" pop-up: New Sample Evaluation / New Inspection (QC Add-Ons). */
  protected async openNew(): Promise<void> {
    const choice = await firstValueFrom(this.dialog.open<NewMenuDialog, void, NewChoice>(NewMenuDialog, { maxWidth: '94vw', autoFocus: false }).afterClosed());
    if (choice === 'inspection') await this.router.navigate(['/addons/inspection/new']);
    else if (choice === 'sample') await this.router.navigate(['/addons/sample-evaluation/new']);
  }

  protected async runSync(silent = false): Promise<void> {
    try {
      await this.sync.run();
      if (!silent) this.toast.success(this.t('Request_SyncDone'));
    } catch (e) {
      this.toast.error(e instanceof Error && e.message === 'Msg_NoInternetConnection' ? this.t('Msg_NoInternetConnection') : this.t('Request_SyncFailed'));
    }
  }
}

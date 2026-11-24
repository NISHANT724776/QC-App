import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { I18n } from '../../core/i18n/i18n';
import { Toast } from '../../core/ui/toast';
import { InspectionSection } from '../../domain/models/inspection';
import { Confirm } from '../../shared/confirm';
import { Icon } from '../../shared/icon';
import { TopBar } from '../../shared/top-bar';
import { InspectionStore } from './inspection-store';

/**
 * Inspection Result shell, as in the source app: header, scrollable tab strip (tabs come from the form
 * configuration), the active section, and Discard / Save (+ "Submit Result" on the Final Result tab).
 */
@Component({
  selector: 'app-inspection-shell',
  imports: [TopBar, RouterOutlet, RouterLink, RouterLinkActive, Icon],
  providers: [InspectionStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-top-bar [title]="t('InspectionResult_Title')" [back]="true" (backClick)="goBack()" />

    @if (store.loading()) {
      <p class="state" role="status">{{ t('Common_Loading') }}</p>
    } @else if (store.loadError() || !store.form()) {
      <div class="state card">
        <app-icon name="warning" [size]="32" />
        <p>{{ t('Msg_NoInternetConnection') }}</p>
        <button class="btn btn-primary" (click)="reload()">{{ t('Request_Sync') }}</button>
      </div>
    } @else {
      <nav class="tabs" aria-label="Inspection sections">
        @for (s of store.sections(); track s.key) {
          <a class="tab" [routerLink]="routeOf(s)" routerLinkActive="on">{{ label(s) }}</a>
        }
      </nav>

      <main class="content"><router-outlet /></main>

      @if (!store.locked()) {
        <footer class="actions">
          <div class="row">
            <button class="btn btn-danger" (click)="discard()">{{ t('Common_Discard') }}</button>
            <button class="btn btn-primary" (click)="save()">{{ t('Common_Save') }}</button>
          </div>
          @if (isFinal()) {
            <button class="btn btn-primary submit" [disabled]="submitting()" (click)="submit()">{{ t('FinalResult_SubmitResult') }}</button>
          }
        </footer>
      }
    }
  `,
  styles: `
    :host{display:flex;flex-direction:column;min-height:100vh;background:var(--surface)}
    .state{margin:48px auto;max-width:360px;padding:24px;text-align:center;display:grid;justify-items:center;gap:12px}
    .tabs{display:flex;overflow-x:auto;background:#f5f5f5;scrollbar-width:none;position:sticky;top:0;z-index:4}
    .tabs::-webkit-scrollbar{display:none}
    .tab{flex:none;display:grid;place-items:center;min-height:50px;padding:0 15px;font-size:16px;color:#6b7a82;text-decoration:none;border-bottom:3px solid transparent;white-space:nowrap}
    .tab:hover{background:#eceff0}
    .tab.on{color:var(--brand);border-bottom-color:var(--brand);background:#fff}
    .content{flex:1;padding:10px 12px 150px;width:100%;max-width:1400px;margin:0 auto}
    .actions{position:fixed;left:0;right:0;bottom:0;display:grid;gap:10px;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:#fff;z-index:5;max-width:1400px;margin:0 auto}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .actions .btn{min-height:48px;font-size:17px;font-weight:400}
    .submit{width:100%}
  `,
})
export class InspectionShell implements OnDestroy {
  readonly requestId = input.required<string>();
  readonly orderId = input.required<string>();

  protected readonly store = inject(InspectionStore);
  private readonly router = inject(Router);
  private readonly confirm = inject(Confirm);
  private readonly toast = inject(Toast);
  protected readonly t = inject(I18n).t;
  protected readonly submitting = signal(false);
  protected readonly isFinal = computed(() => this.store.sectionOf(this.store.activeSection())?.kind === 'final');

  constructor() {
    // (re)load whenever the order in the URL changes, so one order's data can never show under another order
    effect(() => {
      const id = this.orderId();
      untracked(() => {
        this.store.dispose();
        void this.store.load(id);
      });
    });
  }

  ngOnDestroy(): void {
    this.store.dispose();
  }

  protected reload(): void {
    void this.store.load(this.orderId());
  }

  protected routeOf(s: InspectionSection): string[] {
    switch (s.kind) {
      case 'summary': return ['summary'];
      case 'ra': return ['ra-sheet'];
      case 'measurement': return ['measurements'];
      case 'defects': return ['defects'];
      case 'final': return ['final'];
      case 'evaluation': return ['evaluation', s.groupId ?? ''];
    }
  }

  protected label(s: InspectionSection): string {
    const key = { summary: 'Section_Summary', ra: 'Section_RaSheet', measurement: 'Section_Measurements', defects: 'Section_Defects', final: 'Section_Final' }[s.kind as string];
    return key ? this.t(key) : s.label;
  }

  protected async save(): Promise<void> {
    await this.store.save(this.store.activeSection());
    this.toast.success(this.t('Msg_Saved'));
  }

  protected async discard(): Promise<void> {
    if (!(await this.confirm.ask(this.t('Msg_DiscardConfirm'), { danger: true, confirmLabel: this.t('Common_Discard') }))) return;
    this.store.discard(this.store.activeSection());
  }

  /** Submit Result (Final tab). Required items are assumed (docs BR-F8); missing ones are named in a message. */
  protected async submit(): Promise<void> {
    if (!this.store.canSubmit()) {
      const missing = this.store.readiness().filter((i) => i.blocking && !i.done).map((i) => i.label);
      this.toast.error(`${this.t('FinalResult_Required')}: ${missing.join(', ')}`);
      return;
    }
    if (!(await this.confirm.ask(this.t('FinalResult_SubmitConfirm'), { confirmLabel: this.t('FinalResult_SubmitResult') }))) return;
    this.submitting.set(true);
    try {
      if (await this.store.submit()) {
        this.toast.success(this.t('FinalResult_Submitted'));
        await this.router.navigate(['/requests']);
      }
    } finally {
      this.submitting.set(false);
    }
  }

  protected goBack(): void {
    void this.router.navigate(['/requests']);
  }

  /** Used by the canDeactivate guard. */
  async canLeave(): Promise<boolean> {
    if (!this.store.hasUnsaved()) return true;
    return this.confirm.ask(this.t('Msg_UnsavedLeave'), { danger: true, confirmLabel: this.t('Common_Confirm') });
  }

  @HostListener('window:beforeunload', ['$event'])
  protected onUnload(e: BeforeUnloadEvent): void {
    if (this.store.hasUnsaved()) e.preventDefault();
  }
}

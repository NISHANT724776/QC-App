import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { I18n } from '../../core/i18n/i18n';
import { InspectionRequest, OrderLine, RequestAttachment } from '../../domain/models/request';
import { Icon } from '../../shared/icon';
import { fromIso, toIso } from '../../shared/date-utils';

/**
 * One inspection request. Tapping the card toggles the order table (no chevron, as in the source).
 * Portrait table: Order No. · Style Name · Order Qty. · Offer Qty.
 * Landscape table: Order No. · Color · Ordered · Offered · A.Offered · Accepted · Delivery Date · Status.
 * Completed orders add the PDF and sync icons.
 */
@Component({
  selector: 'app-request-card',
  imports: [DatePipe, DecimalPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card req">
      <div class="head">
        <button type="button" class="summary" [disabled]="!request().isExpanderEnable" [attr.aria-expanded]="expanded()" (click)="expanded.set(!expanded())">
          <div class="img">
            @if (request().imageUrl) {
              <img [src]="request().imageUrl" alt="" loading="lazy" />
            } @else {
              <app-icon name="image" [size]="56" />
            }
            @if (request().styleCount > 1) {
              <span class="more" [title]="t('Request_MoreStyles')">+{{ request().styleCount }}</span>
            }
          </div>
          <div class="info">
            <div class="line1">
              <span class="dot" [class.ok]="request().status === 'Completed'" aria-hidden="true"></span>
              <span class="num">{{ t('Request_Prefix') }} {{ request().tranNum }}</span>
              <span class="sr-only">{{ request().status }}</span>
              @if (request().isNew && request().status === 'Active') {<span class="new">NEW</span>}
              @if (due(); as d) {<span class="due" [class.over]="d.cls === 'over'" [class.today]="d.cls === 'today'" [class.soon]="d.cls === 'soon'">{{ d.text }}</span>}
            </div>
            <div class="type">{{ request().inspectionType }}</div>
            <div class="code">{{ request().articleCode }}{{ request().buyerRef }}</div>
            <div class="name">{{ request().articleName }}</div>
            <div class="supplier">{{ request().supplierName }}</div>
          </div>
        </button>
        @if (request().isInspectionCancel && request().status === 'Active') {
          <button type="button" class="cancel" (click)="cancel.emit()" [attr.aria-label]="t('Request_Cancel')" [title]="t('Request_Cancel')"><app-icon name="close" [size]="20" /></button>
        }
      </div>

      @if (expanded()) {
        <div class="body">
          @if (request().kind === 'sample' && request().sample; as sm) {
            <div class="table" role="table">
              <div class="tr th sm" role="row">
                <span role="columnheader">{{ t('Addons_SampleType') }}</span><span role="columnheader" class="r">{{ t('Addons_Lines') }}</span><span role="columnheader" class="r">{{ t('Addons_Qty') }}</span><span role="columnheader" class="r">{{ t('Addons_Photos') }}</span>
              </div>
              <div class="tr sm" role="row">
                <span role="cell">{{ sm.sampleType }}</span><span role="cell" class="r">{{ sm.lines }}</span><span role="cell" class="r">{{ sm.qty | number }} {{ sm.uom }}</span><span role="cell" class="r">{{ sm.photos }}</span>
              </div>
            </div>
            <p class="comment dim">{{ t('Addons_SampleResultNotInSpec') }}</p>
          } @else {
          <div class="table" role="table" [class.ls]="landscape()">
            <div class="tr th" role="row">
              <span role="columnheader">{{ t('Request_OrderNo') }}</span>
              @if (landscape()) {
                <span role="columnheader">{{ t('Request_Color') }}</span>
                <span role="columnheader" class="r">{{ t('Request_Ordered') }}</span>
                <span role="columnheader" class="r">{{ t('Request_Offered') }}</span>
                <span role="columnheader" class="r">{{ t('Request_AOffered') }}</span>
                <span role="columnheader" class="r">{{ t('Request_Accepted') }}</span>
                <span role="columnheader">{{ t('Request_DeliveryDate') }}</span>
                <span role="columnheader">{{ t('Request_Status') }}</span>
              } @else {
                <span role="columnheader">{{ t('Request_StyleName') }}</span>
                <span role="columnheader" class="r">{{ t('Request_OrderQty') }}</span>
                <span role="columnheader" class="r">{{ t('Request_OfferQty') }}</span>
              }
              <span role="columnheader"></span>
            </div>
            @for (o of request().orders; track o.qaRequestOrderId) {
              <div class="tr" role="row" [class.complete]="o.isCompleted">
                <span role="cell"><button type="button" class="link" (click)="open.emit(o)">{{ o.orderRefNo }}</button></span>
                @if (landscape()) {
                  <span role="cell">{{ o.colorName }}</span>
                  <span role="cell" class="r">{{ o.orderQty | number: '1.1-1' }}</span>
                  <span role="cell" class="r">{{ o.offeredQty | number: '1.1-1' }}</span>
                  <span role="cell" class="r">{{ o.actualOfferedQty }}</span>
                  <span role="cell" class="r">{{ o.acceptedQty }}</span>
                  <span role="cell">{{ o.deliveryDate | date: 'dd/MM/yyyy' }}</span>
                  <span role="cell">{{ o.status }}</span>
                } @else {
                  <span role="cell">{{ o.styleName }}</span>
                  <span role="cell" class="r">{{ o.orderQty | number: '1.1-1' }}</span>
                  <span role="cell" class="r">{{ o.offeredQty | number: '1.1-1' }}</span>
                }
                <span role="cell" class="acts">
                  @if (o.isCompleted) {
                    <button type="button" class="ico" (click)="report.emit(o)" [attr.aria-label]="t('Request_Report')" [title]="t('Request_Report')"><app-icon name="pdf" [size]="28" /></button>
                    <button type="button" class="ico sync" [class.pend]="o.syncState === 'pending'" [class.sent]="o.syncState === 'synced'"
                      [title]="o.syncState === 'pending' ? t('Request_SyncPending') : t('Request_Synced')"
                      [attr.aria-label]="o.syncState === 'pending' ? t('Request_SyncPending') : t('Request_Synced')"
                      (click)="o.syncState === 'pending' && syncNow.emit()"><app-icon name="sync" [size]="22" /></button>
                  }
                </span>
              </div>
            }
          </div>
          }
          @if (request().comment) {
            <p class="comment">{{ request().comment }}</p>
          }
          @if (request().attachments.length) {
            <ul class="atts" [attr.aria-label]="t('Request_Attachments')">
              @for (a of request().attachments; track a.id) {
                <li><button type="button" class="att" (click)="attachment.emit(a)"><app-icon name="link" [size]="16" /> {{ a.userFileName }}</button></li>
              }
            </ul>
          }
        </div>
      }
    </article>
  `,
  styles: `
    :host{display:block;min-width:0}
    .req{overflow:hidden;position:relative;min-width:0}
    .head{position:relative}
    .summary{width:100%;display:flex;gap:16px;align-items:flex-start;padding:12px 44px 12px 12px;border:0;background:transparent;text-align:left;cursor:pointer;font:inherit;color:inherit}
    .summary:disabled{cursor:default}
    .summary:focus-visible{outline-offset:-2px}
    .img{position:relative;flex:none;width:120px;height:120px;border:1px solid var(--line);border-radius:2px;display:grid;place-items:center;color:#d4d9dc;background:#fff}
    .img img{width:100%;height:100%;object-fit:cover}
    .more{position:absolute;right:-8px;top:-8px;background:var(--brand-dark);color:#fff;border-radius:999px;padding:1px 8px;font-size:12px;font-weight:700}
    .info{min-width:0;display:grid;gap:1px;align-content:start}
    .line1{display:flex;align-items:center;gap:8px;font-size:16px}
    .dot{width:12px;height:12px;border-radius:50%;background:#9e9e9e;flex:none}
    .dot.ok{background:#3ecb86}
    .type{font-weight:700;color:#9aa1a5;font-size:14px}
    .code{font-size:14px}
    .name{font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .supplier{color:#9aa1a5;font-size:14px}
    .cancel{position:absolute;right:6px;top:6px;width:36px;height:36px;border:0;border-radius:50%;background:transparent;color:var(--danger);cursor:pointer;display:grid;place-items:center}
    .cancel:hover,.cancel:focus-visible{background:var(--danger-soft)}
    .body{padding:0 12px 12px}
    .table{margin-top:4px;overflow-x:auto}
    .tr{display:grid;grid-template-columns:minmax(70px,1fr) minmax(70px,1.2fr) 64px 64px 88px;gap:8px;align-items:center;min-height:48px;padding:0 8px;border-bottom:1px solid var(--line)}
    .ls .tr{grid-template-columns:minmax(80px,1fr) minmax(110px,1.3fr) 80px 80px 80px 80px 110px 100px 96px;min-width:840px}
    .tr.th{font-weight:400;color:#3a464c;font-size:16px;min-height:44px}
    .tr.complete{box-shadow:inset 4px 0 0 #0a8a0a}
    .r{text-align:right;font-variant-numeric:tabular-nums}
    .link{border:0;background:none;color:var(--brand);font:inherit;cursor:pointer;padding:12px 0;min-height:44px}
    .link:hover{text-decoration:underline}
    .acts{display:flex;gap:4px;justify-content:flex-end}
    .ico{width:44px;height:44px;border:0;background:transparent;border-radius:50%;cursor:pointer;color:#555;display:grid;place-items:center}
    .ico:hover,.ico:focus-visible{background:var(--surface-2)}
    .sync.pend{color:#e25555}.sync.sent{color:var(--ok);cursor:default}
    .comment{margin:12px 0 0;font-size:14px}.comment.dim{color:var(--muted);font-size:13px}
    .tr.sm{grid-template-columns:minmax(120px,1.4fr) 90px 110px 70px}
    .new{background:#22a45a;color:#fff;border-radius:4px;padding:0 6px;font-size:11px;font-weight:700;letter-spacing:.5px}
    .due{border-radius:999px;padding:0 8px;font-size:12px;background:#eef1f3;color:#5b676d}
    .due.soon{background:#fff4d6;color:#7a5b00}.due.today{background:#ffe3c2;color:#8a4a00}.due.over{background:var(--danger-soft);color:var(--danger);font-weight:600}
    .atts{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:2px}
    .att{border:0;background:none;display:flex;align-items:center;gap:6px;min-height:36px;color:var(--text);font:inherit;font-size:14px;cursor:pointer;text-align:left;overflow:hidden;max-width:100%}
    .att:hover{color:var(--brand-dark);text-decoration:underline}
  `,
})
export class RequestCard {
  readonly request = input.required<InspectionRequest>();
  readonly landscape = input(false);
  readonly open = output<OrderLine>();
  readonly report = output<OrderLine>();
  readonly cancel = output<void>();
  readonly attachment = output<RequestAttachment>();
  readonly syncNow = output<void>();
  protected readonly t = inject(I18n).t;
  protected readonly expanded = signal(false);

  /** "Due in 3d" chip on Active requests, from the target / result-required-by date */
  protected readonly due = computed(() => {
    const r = this.request();
    if (r.status !== 'Active' || !r.dueDate) return null;
    const d = Math.round((fromIso(r.dueDate).getTime() - fromIso(toIso(new Date())).getTime()) / 86_400_000);
    if (d < 0) return { text: this.t('Addons_Overdue', { n: -d }), cls: 'over' };
    if (d === 0) return { text: this.t('Addons_DueToday'), cls: 'today' };
    if (d === 1) return { text: this.t('Addons_DueTomorrow'), cls: 'soon' };
    return { text: this.t('Addons_DueIn', { n: d }), cls: '' };
  });
}

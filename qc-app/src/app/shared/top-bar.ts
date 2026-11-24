import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';

/** Branded header (title, optional back, profile avatar) shared by all authenticated pages. */
@Component({
  selector: 'app-top-bar',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bar">
      <div class="side">
        @if (back()) {
          <button class="icon-btn" (click)="backClick.emit()" aria-label="Back"><app-icon name="back" [size]="24" /></button>
        }
      </div>
      <h1>{{ title() }}</h1>
      <div class="side end">
        @if (profile()) {
          <a class="avatar" routerLink="/profile" aria-label="User profile"><app-icon name="person" [size]="26" /></a>
        }
      </div>
    </header>
  `,
  styles: `
    .bar{display:grid;grid-template-columns:56px 1fr 56px;align-items:center;min-height:56px;color:#fff;
      background:linear-gradient(110deg,#3dbdca 0%,#27a8bd 45%,#3a8ca6 75%,#5b94ac 100%);box-shadow:0 1px 4px rgb(0 0 0 / 20%)}
    h1{margin:0;font-size:20px;font-weight:300;text-align:center;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .side{display:flex;align-items:center;padding:0 8px}.end{justify-content:flex-end}
    .icon-btn{width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:#fff;display:grid;place-items:center;cursor:pointer;text-decoration:none}
    .icon-btn:hover,.icon-btn:focus-visible{background:rgb(255 255 255 / 20%)}
    .avatar{width:40px;height:40px;border-radius:50%;background:#fff;color:#9aa5ad;display:grid;place-items:center}
    .avatar:focus-visible{outline:2px solid #fff;outline-offset:2px}
  `,
})
export class TopBar {
  readonly title = input.required<string>();
  readonly back = input(false);
  readonly profile = input(true);
  readonly backClick = output<void>();
}

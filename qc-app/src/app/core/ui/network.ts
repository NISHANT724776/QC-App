import { Injectable, signal } from '@angular/core';

/** Browser online/offline state (drives the "No internet connection" notices). */
@Injectable({ providedIn: 'root' })
export class Network {
  readonly online = signal(navigator.onLine);

  constructor() {
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
  }
}

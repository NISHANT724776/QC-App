import { Injectable } from '@angular/core';

/**
 * Minimal promise-based key/value store over IndexedDB (falls back to memory when IndexedDB is
 * unavailable, e.g. private windows). Holds requests, form configs, drafts and the sync outbox so
 * the app is offline-first like the source app.
 *
 * Keys prefixed with `srv:` belong to the MOCK SERVER and survive "Unregister".
 */
@Injectable({ providedIn: 'root' })
export class LocalDb {
  private readonly mem = new Map<string, unknown>();
  private readonly dbPromise: Promise<IDBDatabase | null> = this.open();

  private open(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('wfx-qc', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
    const db = await this.dbPromise;
    if (!db) return undefined;
    return new Promise<T | undefined>((resolve) => {
      try {
        const tx = db.transaction('kv', mode);
        const req = fn(tx.objectStore('kv'));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (this.mem.has(key)) return structuredClone(this.mem.get(key)) as T;
    const v = await this.run<T>('readonly', (s) => s.get(key) as IDBRequest<T>);
    if (v !== undefined) this.mem.set(key, structuredClone(v));
    return v;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.mem.set(key, structuredClone(value));
    await this.run('readwrite', (s) => s.put(structuredClone(value), key));
  }

  async remove(key: string): Promise<void> {
    this.mem.delete(key);
    await this.run('readwrite', (s) => s.delete(key));
  }

  async keys(prefix = ''): Promise<string[]> {
    const all = (await this.run<IDBValidKey[]>('readonly', (s) => s.getAllKeys())) ?? [];
    const set = new Set<string>([...all.map(String), ...this.mem.keys()]);
    return [...set].filter((k) => k.startsWith(prefix));
  }

  /** Remove everything that is local to the device (keeps the mock server's own state). */
  async clearLocal(): Promise<void> {
    for (const k of await this.keys()) {
      if (!k.startsWith('srv:')) await this.remove(k);
    }
  }
}

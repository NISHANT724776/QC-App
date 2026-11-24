import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthRepository, RegistrationInput } from '../../data/repositories';
import { LocalDb } from '../storage/local-db';

export interface Registration {
  username: string;
  companyId: string;
  companyUrl: string;
  displayName: string;
  token: string;
  pinHash: string | null;
  biometricCredentialId: string | null;
}

const UNLOCK_KEY = 'wfx.unlocked';

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return hex(await crypto.subtle.digest('SHA-256', data));
}

/**
 * Device registration + PIN + biometric (WebAuthn) lock.
 * Flow of the source app: register (user, password, company id, company URL) -> create 4-digit PIN
 * -> PIN (or biometric) on each launch. The PIN is hashed locally; there is no server-side PIN.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly repo = inject(AuthRepository);
  private readonly db = inject(LocalDb);

  readonly registration = signal<Registration | null>(null);
  readonly unlocked = signal(sessionStorage.getItem(UNLOCK_KEY) === '1');
  readonly isRegistered = computed(() => this.registration() !== null);
  readonly hasPin = computed(() => !!this.registration()?.pinHash);
  readonly displayName = computed(() => this.registration()?.displayName ?? '');
  readonly companyUrl = computed(() => this.registration()?.companyUrl ?? '');
  readonly biometricAvailable = signal(false);

  async init(): Promise<void> {
    this.registration.set((await this.db.get<Registration>('registration')) ?? null);
    try {
      this.biometricAvailable.set(
        !!window.PublicKeyCredential &&
          (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()),
      );
    } catch {
      this.biometricAvailable.set(false);
    }
  }

  async register(input: RegistrationInput): Promise<void> {
    const res = await this.repo.register(input);
    await this.persist({
      username: input.username,
      companyId: input.companyId,
      companyUrl: input.companyUrl.replace(/\/+$/, ''),
      displayName: res.displayName,
      token: res.token,
      pinHash: null,
      biometricCredentialId: null,
    });
  }

  async createPin(pin: string): Promise<void> {
    const r = this.requireReg();
    await this.persist({ ...r, pinHash: await hashPin(pin, r.username) });
    this.setUnlocked(true);
  }

  async verifyPin(pin: string): Promise<boolean> {
    const r = this.requireReg();
    const ok = !!r.pinHash && (await hashPin(pin, r.username)) === r.pinHash;
    if (ok) this.setUnlocked(true);
    return ok;
  }

  /** Profile "Update": change company URL and/or PIN (PIN optional, 4 digits). */
  async updateProfile(companyUrl: string, pin: string | null): Promise<void> {
    const r = this.requireReg();
    await this.persist({
      ...r,
      companyUrl: companyUrl.replace(/\/+$/, ''),
      pinHash: pin ? await hashPin(pin, r.username) : r.pinHash,
    });
  }

  lock(): void {
    this.setUnlocked(false);
  }

  async unregister(): Promise<void> {
    await this.db.clearLocal();
    this.registration.set(null);
    this.setUnlocked(false);
  }

  /* ----------------------------- biometric (WebAuthn, local convenience lock) */
  async enableBiometric(): Promise<boolean> {
    const r = this.requireReg();
    if (!this.biometricAvailable()) return false;
    try {
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'WFX Quality Controller' },
          user: { id: new TextEncoder().encode(r.username), name: r.username, displayName: r.displayName },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;
      if (!cred) return false;
      await this.persist({ ...r, biometricCredentialId: btoa(String.fromCharCode(...new Uint8Array(cred.rawId))) });
      return true;
    } catch {
      return false;
    }
  }

  async disableBiometric(): Promise<void> {
    const r = this.requireReg();
    await this.persist({ ...r, biometricCredentialId: null });
  }

  async biometricLogin(): Promise<boolean> {
    const id = this.registration()?.biometricCredentialId;
    if (!id) return false;
    try {
      const raw = Uint8Array.from(atob(id), (c) => c.charCodeAt(0));
      const res = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: 'public-key', id: raw }],
          userVerification: 'required',
          timeout: 60000,
        },
      });
      if (res) this.setUnlocked(true);
      return !!res;
    } catch {
      return false;
    }
  }

  private requireReg(): Registration {
    const r = this.registration();
    if (!r) throw new Error('Not registered');
    return r;
  }

  private async persist(r: Registration): Promise<void> {
    this.registration.set(r);
    await this.db.set('registration', r);
  }

  private setUnlocked(v: boolean): void {
    this.unlocked.set(v);
    try {
      if (v) sessionStorage.setItem(UNLOCK_KEY, '1');
      else sessionStorage.removeItem(UNLOCK_KEY);
    } catch {
      /* ignore */
    }
  }
}

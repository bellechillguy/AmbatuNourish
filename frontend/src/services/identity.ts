/**
 * Identity & Access (generic subdomain, milik layanan bersama / Ambatufit).
 * HTTP mengikuti gateway yang sudah ada: /api/auth/ → koleksi `users` PocketBase.
 * Field profil & aturan kata sandi menunggu kontrak Identity & Access (FR-AUTH-07).
 */
import { config } from '../shared/api/config';
import { AppError } from '../shared/api/errors';
import { request } from '../shared/api/http';
import type { Session, UserProfile } from '../shared/domain/types';
import { delay, ensureOnline } from './network';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface IdentityService {
  register(input: RegisterInput): Promise<Session>;
  login(email: string, password: string): Promise<Session>;
  requestPasswordReset(email: string): Promise<void>;
  updateProfile(userId: string, patch: { name: string }): Promise<UserProfile>;
  logout(): Promise<void>;
}

/* ---------- HTTP (gateway PocketBase) ---------- */

interface PbUser {
  id: string;
  name?: string;
  email: string;
}

const toProfile = (r: PbUser): UserProfile => ({ id: r.id, name: r.name ?? '', email: r.email });

class HttpIdentityService implements IdentityService {
  async register(input: RegisterInput): Promise<Session> {
    await request<PbUser>('/auth/records', {
      method: 'POST',
      auth: false,
      body: { name: input.name, email: input.email, password: input.password, passwordConfirm: input.password },
    });
    return this.login(input.email, input.password);
  }

  async login(email: string, password: string): Promise<Session> {
    try {
      const res = await request<{ token: string; record: PbUser }>('/auth/auth-with-password', {
        method: 'POST',
        auth: false,
        body: { identity: email, password },
      });
      return { token: res.token, user: toProfile(res.record) };
    } catch (e) {
      // PocketBase mengembalikan 400 untuk kredensial salah → tampilkan error level form.
      if (e instanceof AppError && e.kind === 'VALIDATION') throw new AppError('UNAUTHORIZED');
      throw e;
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    await request('/auth/request-password-reset', { method: 'POST', auth: false, body: { email } });
  }

  async updateProfile(userId: string, patch: { name: string }): Promise<UserProfile> {
    const r = await request<PbUser>(`/auth/records/${encodeURIComponent(userId)}`, { method: 'PATCH', body: patch });
    return toProfile(r);
  }

  async logout(): Promise<void> {
    // Token stateless (JWT); pembersihan dilakukan di perangkat.
  }
}

/* ---------- Mock (DEMO) ---------- */

class MockIdentityService implements IdentityService {
  private users = new Map<string, { profile: UserProfile; password: string }>([
    ['rani.pratiwi@email.com', { profile: { id: 'demo-user', name: 'Rani Pratiwi', email: 'rani.pratiwi@email.com' }, password: 'demo12345' }],
  ]);

  async register(input: RegisterInput): Promise<Session> {
    await delay();
    ensureOnline();
    const key = input.email.toLowerCase();
    if (this.users.has(key)) {
      throw new AppError('VALIDATION', undefined, { fieldErrors: { email: 'Email ini sudah terdaftar. Masuk atau gunakan email lain.' } });
    }
    const profile = { id: `demo-${Date.now()}`, name: input.name, email: input.email };
    this.users.set(key, { profile, password: input.password });
    return { token: `demo-token-${profile.id}`, user: profile };
  }

  async login(email: string, password: string): Promise<Session> {
    await delay();
    ensureOnline();
    const u = this.users.get(email.toLowerCase());
    if (!u || u.password !== password) throw new AppError('UNAUTHORIZED');
    return { token: `demo-token-${u.profile.id}`, user: u.profile };
  }

  async requestPasswordReset(): Promise<void> {
    await delay();
    ensureOnline();
    // Selalu sukses: salinan netral tidak mengonfirmasi apakah email terdaftar.
  }

  async updateProfile(userId: string, patch: { name: string }): Promise<UserProfile> {
    await delay();
    ensureOnline();
    for (const u of this.users.values()) {
      if (u.profile.id === userId) {
        u.profile = { ...u.profile, ...patch };
        return u.profile;
      }
    }
    throw new AppError('NOT_FOUND');
  }

  async logout(): Promise<void> {
    await delay(100);
  }
}

export const identityService: IdentityService = config.useMock ? new MockIdentityService() : new HttpIdentityService();

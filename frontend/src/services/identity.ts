/** Identity & Access diakses lewat gateway AmbatuNourish. */
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

class HttpIdentityService implements IdentityService {
  register(input: RegisterInput): Promise<Session> {
    return request('/auth/register', { method: 'POST', auth: false, body: input });
  }

  login(email: string, password: string): Promise<Session> {
    return request('/auth/login', { method: 'POST', auth: false, body: { email, password } });
  }

  requestPasswordReset(email: string): Promise<void> {
    return request('/auth/reset-password', { method: 'POST', auth: false, body: { email } });
  }

  updateProfile(_userId: string, patch: { name: string }): Promise<UserProfile> {
    return request('/auth/me', { method: 'PATCH', body: patch });
  }

  logout(): Promise<void> {
    return request('/auth/logout', { method: 'POST' });
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

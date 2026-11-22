import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { AppError } from '../api/errors';
import { setAuthToken, setUnauthorizedHandler } from '../api/ApiService';
import type { Session, UserProfile } from '../domain/types';
import { identityService, type RegisterInput } from '../../services/identity';
import { clearUserData, secureSession } from './storage';

interface SessionContextValue {
  ready: boolean;
  session: Session | null;
  user: UserProfile | null;
  login(email: string, password: string): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  /** clearLocal=true → hapus data lokal (termasuk perubahan belum tersinkron). */
  logout(opts?: { clearLocal?: boolean }): Promise<void>;
  updateProfile(name: string): Promise<void>;
  /** Setelah registrasi, tampilkan A3 sebelum masuk ke tab. */
  justRegistered: boolean;
  finishOnboarding(): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [justRegistered, setJustRegistered] = useState(false);

  const persist = useCallback(async (s: Session | null) => {
    setSession(s);
    setAuthToken(s?.token ?? null);
    if (s) await secureSession.save(JSON.stringify(s));
    else await secureSession.clear();
  }, []);

  useEffect(() => {
    (async () => {
      const raw = await secureSession.load();
      if (raw) {
        try {
          const s = JSON.parse(raw) as Session;
          setSession(s);
          setAuthToken(s.token);
        } catch {
          await secureSession.clear();
        }
      }
      setReady(true);
    })();
  }, []);

  // Sesi kedaluwarsa (401) → kembali ke A1/A4.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void persist(null);
    });
    return () => setUnauthorizedHandler(null);
  }, [persist]);

  const value = useMemo<SessionContextValue>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      justRegistered,
      async login(email, password) {
        const s = await identityService.login(email.trim(), password);
        await persist(s);
      },
      async register(input) {
        const s = await identityService.register({ ...input, email: input.email.trim() });
        setJustRegistered(true);
        await persist(s);
      },
      async logout(opts) {
        const userId = session?.user.id;
        try {
          await identityService.logout();
        } catch (error) {
          // AmbatuFit belum punya endpoint pencabutan JWT. Akhiri sesi di perangkat.
          if (!(error instanceof AppError) || !['OFFLINE', 'TIMEOUT', 'UNAUTHORIZED', 'CONTRACT_PENDING'].includes(error.kind)) throw error;
        }
        setJustRegistered(false);
        await persist(null);
        if (userId && opts?.clearLocal !== false) await clearUserData(userId);
      },
      async updateProfile(name) {
        if (!session) return;
        const user = await identityService.updateProfile(session.user.id, { name });
        await persist({ ...session, user });
      },
      finishOnboarding() {
        setJustRegistered(false);
      },
    }),
    [ready, session, justRegistered, persist],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession harus di dalam SessionProvider');
  return ctx;
}

import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

import { readJson, writeJson } from './storage';

/** Pengaturan tampilan & aksesibilitas (N3, PROPOSED). Ukuran teks selalu mengikuti perangkat. */
interface UiPrefs {
  reduceMotion: boolean;
  hapticOnScan: boolean;
  underlineLinks: boolean;
}

interface UiPrefsValue extends UiPrefs {
  set<K extends keyof UiPrefs>(key: K, value: UiPrefs[K]): void;
}

const KEY = 'ambatunourish:ui-prefs';
const defaults: UiPrefs = { reduceMotion: false, hapticOnScan: true, underlineLinks: false };
const Ctx = createContext<UiPrefsValue>({ ...defaults, set: () => undefined });

export function PreferencesUiProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UiPrefs>(defaults);

  useEffect(() => {
    (async () => {
      const stored = await readJson<Partial<UiPrefs>>(KEY, {});
      const osReduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      setPrefs({ ...defaults, reduceMotion: osReduce, ...stored });
    })();
  }, []);

  const value = useMemo<UiPrefsValue>(
    () => ({
      ...prefs,
      set(key, v) {
        setPrefs((p) => {
          const next = { ...p, [key]: v };
          void writeJson(KEY, next);
          return next;
        });
      },
    }),
    [prefs],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUiPrefs() {
  return useContext(Ctx);
}

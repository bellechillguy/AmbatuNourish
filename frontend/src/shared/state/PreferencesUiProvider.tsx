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
  systemReduceMotion: boolean;
  set<K extends keyof UiPrefs>(key: K, value: UiPrefs[K]): void;
}

const KEY = 'ambatunourish:ui-prefs';
const defaults: UiPrefs = { reduceMotion: false, hapticOnScan: true, underlineLinks: false };
const Ctx = createContext<UiPrefsValue>({ ...defaults, systemReduceMotion: false, set: () => undefined });

export function PreferencesUiProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UiPrefs>(defaults);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await readJson<Partial<UiPrefs>>(KEY, {});
      setPrefs({ ...defaults, ...stored });
    })();
  }, []);

  useEffect(() => {
    let awaitingInitialSetting = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      awaitingInitialSetting = false;
      setSystemReduceMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (awaitingInitialSetting) setSystemReduceMotion(enabled);
    }).catch(() => undefined);

    return () => {
      awaitingInitialSetting = false;
      subscription?.remove();
    };
  }, []);

  const value = useMemo<UiPrefsValue>(
    () => ({
      ...prefs,
      systemReduceMotion,
      reduceMotion: prefs.reduceMotion || systemReduceMotion,
      set(key, v) {
        setPrefs((p) => {
          const next = { ...p, [key]: v };
          void writeJson(KEY, next);
          return next;
        });
      },
    }),
    [prefs, systemReduceMotion],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUiPrefs() {
  return useContext(Ctx);
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { ConsumptionRecord, MealPlanEntry, SyncStatus } from '../domain/types';
import { syncService, type EntityType } from '../../services/sync';
import { useConnectivity } from '../state/ConnectivityProvider';
import { useSession } from '../state/SessionProvider';
import { readJson, userKey, writeJson } from '../state/storage';
import {
  applyResults,
  emptySyncState,
  failBatch,
  globalStatus,
  makeOp,
  markSyncing,
  readyOps,
  removeEntity,
  replaceEntity,
  resolveConflict as resolveConflictPure,
  type ConflictItem,
  type SyncState,
} from './queue';

interface OfflineDataValue {
  loaded: boolean;
  plans: MealPlanEntry[];
  records: ConsumptionRecord[];
  queueSize: number;
  queue: SyncState['queue'];
  conflicts: ConflictItem[];
  lastSyncedAt: string | null;
  syncing: boolean;
  status: SyncStatus;
  /** Simpan (buat/ubah) rencana. Mengembalikan fungsi undo. */
  savePlan(entry: MealPlanEntry): () => void;
  deletePlan(id: string): () => void;
  /** Tandai rencana dikonsumsi → buat Catatan Konsumsi (FR-MEAL-11, FR-LOG-09). */
  markConsumed(planId: string, record: ConsumptionRecord): () => void;
  saveRecord(record: ConsumptionRecord): () => void;
  deleteRecord(id: string): () => void;
  syncNow(): Promise<void>;
  retry(opId?: string): Promise<void>;
  resolveConflict(opId: string, choice: 'LOCAL' | 'SERVER'): void;
}

const OfflineDataContext = createContext<OfflineDataValue | null>(null);

export function OfflineDataProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const { online } = useConnectivity();
  const [state, setState] = useState<SyncState>(emptySyncState);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const syncingRef = useRef(false);
  const onlineRef = useRef(online);
  onlineRef.current = online;

  const storageKey = user ? userKey(user.id, 'offline-data') : null;

  /* ---- Muat dari perangkat, lalu tarik dari server bila kosong ---- */
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    if (!storageKey) {
      setState(emptySyncState);
      return;
    }
    (async () => {
      const stored = await readJson<SyncState | null>(storageKey, null);
      if (cancelled) return;
      if (stored) {
        // Operasi yang terputus saat SYNCING dikembalikan ke PENDING.
        setState({ ...stored, queue: stored.queue.map((o) => (o.status === 'SYNCING' ? { ...o, status: 'PENDING' } : o)) });
        setLoaded(true);
        return;
      }
      try {
        const { plans, records } = await syncService.pull();
        if (!cancelled) setState({ ...emptySyncState, plans, records, lastSyncedAt: new Date().toISOString() });
      } catch {
        // Offline / kontrak pending: mulai kosong, data lokal tetap bisa dibuat.
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  /* ---- Persistensi ---- */
  useEffect(() => {
    if (storageKey && loaded) void writeJson(storageKey, state);
  }, [state, storageKey, loaded]);

  const commit = useCallback((fn: (s: SyncState) => SyncState) => {
    setState((s) => {
      const next = fn(s);
      stateRef.current = next;
      return next;
    });
  }, []);

  /* ---- Sinkronisasi ---- */
  const runSync = useCallback(
    async (force: boolean, onlyOpId?: string) => {
      if (syncingRef.current || !onlineRef.current) return;
      const now = Date.now();
      let batch = readyOps(stateRef.current.queue, now, force);
      if (onlyOpId) batch = batch.filter((o) => o.opId === onlyOpId);
      if (batch.length === 0) return;
      const ids = batch.map((o) => o.opId);
      syncingRef.current = true;
      setSyncing(true);
      commit((s) => markSyncing(s, ids));
      try {
        const results = await syncService.push(batch);
        commit((s) => applyResults(s, results, Date.now()));
      } catch {
        commit((s) => failBatch(s, ids, 'server tidak merespons', Date.now()));
      } finally {
        syncingRef.current = false;
        setSyncing(false);
      }
    },
    [commit],
  );

  // Kirim otomatis saat koneksi pulih dan saat aplikasi kembali aktif.
  useEffect(() => {
    if (online && loaded) void runSync(false);
  }, [online, loaded, runSync]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void runSync(false);
    });
    return () => sub.remove();
  }, [runSync]);

  // Retry berkala untuk operasi yang menunggu backoff.
  useEffect(() => {
    const t = setInterval(() => void runSync(false), 15_000);
    return () => clearInterval(t);
  }, [runSync]);

  const scheduleSync = useCallback(() => {
    setTimeout(() => void runSync(false), 800);
  }, [runSync]);

  /* ---- Mutasi ---- */
  const localStatus = (): SyncStatus => (onlineRef.current ? 'PENDING' : 'LOCAL');

  const upsert = useCallback(
    (type: EntityType, entity: MealPlanEntry | ConsumptionRecord) => {
      const prev =
        type === 'MEAL_PLAN'
          ? stateRef.current.plans.find((p) => p.id === entity.id)
          : stateRef.current.records.find((r) => r.id === entity.id);
      const withStatus = { ...entity, syncStatus: localStatus() } as MealPlanEntry | ConsumptionRecord;
      const op = makeOp(type, prev ? 'UPDATE' : 'CREATE', withStatus);
      commit((s) => ({ ...replaceEntity(s, type, withStatus), queue: [...s.queue, op] }));
      scheduleSync();
      return prev;
    },
    [commit, scheduleSync],
  );

  const remove = useCallback(
    (type: EntityType, id: string) => {
      const prev =
        type === 'MEAL_PLAN' ? stateRef.current.plans.find((p) => p.id === id) : stateRef.current.records.find((r) => r.id === id);
      if (!prev) return undefined;
      const op = makeOp(type, 'DELETE', prev);
      commit((s) => ({ ...removeEntity(s, type, id), queue: [...s.queue, op] }));
      scheduleSync();
      return prev;
    },
    [commit, scheduleSync],
  );

  const value = useMemo<OfflineDataValue>(() => {
    const undoFor = (type: EntityType, prev: MealPlanEntry | ConsumptionRecord | undefined, id: string) => () => {
      if (prev) upsert(type, prev);
      else remove(type, id);
    };
    return {
      loaded,
      plans: state.plans,
      records: state.records,
      queue: state.queue,
      queueSize: state.queue.length,
      conflicts: state.conflicts,
      lastSyncedAt: state.lastSyncedAt,
      syncing,
      status: globalStatus(state, syncing),
      savePlan(entry) {
        const prev = upsert('MEAL_PLAN', entry);
        return undoFor('MEAL_PLAN', prev, entry.id);
      },
      deletePlan(id) {
        const prev = remove('MEAL_PLAN', id);
        return () => {
          if (prev) upsert('MEAL_PLAN', prev);
        };
      },
      markConsumed(planId, record) {
        const plan = stateRef.current.plans.find((p) => p.id === planId);
        if (!plan) return () => undefined;
        const prevPlan = upsert('MEAL_PLAN', { ...plan, status: 'CONSUMED', consumedAt: record.consumedAt });
        upsert('CONSUMPTION', { ...record, planEntryId: planId });
        return () => {
          if (prevPlan) upsert('MEAL_PLAN', prevPlan);
          remove('CONSUMPTION', record.id);
        };
      },
      saveRecord(record) {
        const prev = upsert('CONSUMPTION', record);
        return undoFor('CONSUMPTION', prev, record.id);
      },
      deleteRecord(id) {
        const prev = remove('CONSUMPTION', id);
        return () => {
          if (prev) upsert('CONSUMPTION', prev);
        };
      },
      syncNow: () => runSync(true),
      retry: (opId) => runSync(true, opId),
      resolveConflict(opId, choice) {
        commit((s) => resolveConflictPure(s, opId, choice));
        scheduleSync();
      },
    };
  }, [state, loaded, syncing, upsert, remove, runSync, commit, scheduleSync]);

  return <OfflineDataContext.Provider value={value}>{children}</OfflineDataContext.Provider>;
}

export function useOfflineData() {
  const ctx = useContext(OfflineDataContext);
  if (!ctx) throw new Error('useOfflineData harus di dalam OfflineDataProvider');
  return ctx;
}

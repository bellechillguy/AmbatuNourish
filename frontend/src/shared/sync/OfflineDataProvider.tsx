import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { config } from '../api/config';
import { AppState } from 'react-native';

import type { ConsumptionRecord, MealPlanEntry, SyncStatus } from '../domain/types';
import { syncService, type EntityType } from '../../services/sync';
import { useConnectivity } from '../state/ConnectivityProvider';
import { useSession } from '../state/SessionProvider';
import { readJson, userKey, writeJson } from '../state/storage';
import {
  applyResults,
  emptySyncState,
  enqueueChange,
  findEntity,
  failBatch,
  globalStatus,
  markSyncing,
  readyOps,
  mergePull,
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
  const syncingRef = useRef(false);
  const active = useRef(false);
  const onlineRef = useRef(online);
  onlineRef.current = online;
  const storageKey = user ? userKey(user.id, config.useMock ? 'demo-offline-data' : 'offline-data') : null;

  const commit = useCallback((fn: (s: SyncState) => SyncState) => {
    stateRef.current = fn(stateRef.current);
    setState(stateRef.current);
  }, []);

  useEffect(() => {
    active.current = true;
    let cancelled = false;
    if (storageKey) {
      void readJson<SyncState>(storageKey, emptySyncState).then((stored) => {
        if (cancelled) return;
        commit(() => ({ ...stored, queue: stored.queue.map((op) =>
          op.status === 'SYNCING' ? { ...op, status: 'PENDING' } : op,
        ) }));
        setLoaded(true);
      });
    }
    return () => {
      cancelled = true;
      active.current = false;
    };
  }, [commit, storageKey]);

  useEffect(() => {
    if (storageKey && loaded) void writeJson(storageKey, state);
  }, [state, storageKey, loaded]);

  const runSync = useCallback(
    async (force: boolean, onlyOpId?: string, refresh = false) => {
      if (!active.current || !loaded || syncingRef.current || !onlineRef.current) return;
      const getBatch = (immediate = false) => readyOps(stateRef.current.queue, Date.now(), immediate)
        .filter((op) => !onlyOpId || op.opId === onlyOpId).slice(0, 20);
      let batch = getBatch(force);
      if (!batch.length && !refresh) return;
      syncingRef.current = true;
      setSyncing(true);
      try {
        while (batch.length && active.current && onlineRef.current) {
          const ids = batch.map((op) => op.opId);
          commit((current) => markSyncing(current, ids));
          try {
            const results = await syncService.push(batch);
            if (!active.current) return;
            commit((current) => {
              const next = applyResults(current, results, Date.now());
              const returned = new Set(results.map((result) => result.opId));
              return failBatch(next, ids.filter((id) => !returned.has(id)), 'Respons sinkronisasi tidak lengkap', Date.now());
            });
          } catch {
            if (active.current) commit((current) => failBatch(current, ids, 'server tidak merespons', Date.now()));
            break;
          }
          batch = getBatch();
        }
        if (!active.current || !onlineRef.current) return;
        const remote = await syncService.pull();
        if (active.current) commit((current) => mergePull(current, remote));
      } catch {
        // Cache dan antrean tetap tersedia ketika pengambilan data gagal.
      } finally {
        syncingRef.current = false;
        if (active.current) setSyncing(false);
      }
    },
    [commit, loaded],
  );

  useEffect(() => {
    if (online && loaded) void runSync(false, undefined, true);
  }, [online, loaded, runSync]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void runSync(false, undefined, true);
    });
    return () => sub.remove();
  }, [runSync]);

  useEffect(() => {
    const timer = setInterval(() => void runSync(false), 15_000);
    return () => clearInterval(timer);
  }, [runSync]);

  const scheduleSync = useCallback(() => {
    setTimeout(() => void runSync(false), 800);
  }, [runSync]);

  const upsert = useCallback(
    (type: EntityType, entity: MealPlanEntry | ConsumptionRecord) => {
      const prev = findEntity(stateRef.current, type, entity.id);
      const status: SyncStatus = onlineRef.current ? 'PENDING' : 'LOCAL';
      commit((current) => enqueueChange(current, type, { ...entity, syncStatus: status }));
      scheduleSync();
      return prev;
    },
    [commit, scheduleSync],
  );

  const remove = useCallback(
    (type: EntityType, id: string) => {
      const previous = findEntity(stateRef.current, type, id);
      if (!previous) return undefined;
      commit((current) => enqueueChange(current, type, previous, true));
      scheduleSync();
      return previous;
    },
    [commit, scheduleSync],
  );

  const value = useMemo<OfflineDataValue>(() => {
    const undoFor = (type: EntityType, prev: MealPlanEntry | ConsumptionRecord | undefined, id: string) => () => {
      if (prev) upsert(type, prev);
      else remove(type, id);
    };
    const consumed = new Map(state.records.filter((record) => !!record.planEntryId).map((record) => [record.planEntryId, record.consumedAt]));
    const plans = state.plans.map((plan): MealPlanEntry => {
      const time = consumed.get(plan.id);
      if (time) return { ...plan, status: 'CONSUMED', consumedAt: time };
      return config.useMock && !state.queue.some((op) => op.op === 'DELETE' && op.previous && 'snapshot' in op.previous &&
        op.previous.planEntryId === plan.id) ? plan : { ...plan, status: 'PLANNED', consumedAt: undefined };
    });
    return {
      loaded,
      plans,
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
        const current = stateRef.current;
        if (!findEntity(current, 'MEAL_PLAN', planId) || current.records.some((item) => item.planEntryId === planId)) {
          return () => undefined;
        }
        upsert('CONSUMPTION', { ...record, planEntryId: planId });
        return () => { remove('CONSUMPTION', record.id); };
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
      syncNow: () => runSync(true, undefined, true),
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

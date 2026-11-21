/**
 * Logika antrean sinkronisasi (murni, tanpa React) — mudah diuji unit.
 * Aturan (requirements §7.10):
 *  1. Setiap mutasi offline mendapat opId (kunci idempotensi) buatan klien.
 *  2. Item ditandai tersinkron HANYA setelah konfirmasi backend.
 *  3. Retry memakai backoff terbatas dan tidak memblokir operasi lain.
 *  4. Konflik tidak pernah ditimpa diam-diam → disimpan untuk diselesaikan pengguna (O2).
 */
import type { ConsumptionRecord, MealPlanEntry, SyncStatus } from '../domain/types';
import type { EntityType, OpResult, OpType, QueuedOperation } from '../../services/sync';

export interface ConflictItem {
  opId: string;
  entityType: EntityType;
  local: MealPlanEntry | ConsumptionRecord;
  server: MealPlanEntry | ConsumptionRecord;
}

export interface SyncState {
  plans: MealPlanEntry[];
  records: ConsumptionRecord[];
  queue: QueuedOperation[];
  conflicts: ConflictItem[];
  lastSyncedAt: string | null;
}

export const emptySyncState: SyncState = { plans: [], records: [], queue: [], conflicts: [], lastSyncedAt: null };

let counter = 0;
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeOp(
  entityType: EntityType,
  op: OpType,
  entity: MealPlanEntry | ConsumptionRecord,
): QueuedOperation {
  return {
    opId: newId('op'),
    entityType,
    entityId: entity.id,
    op,
    payload: op === 'DELETE' ? null : entity,
    baseVersion: entity.version,
    createdAt: new Date().toISOString(),
    status: 'PENDING',
    attempts: 0,
  };
}

/** Backoff eksponensial terbatas: 2s, 4s, 8s … maks 5 menit. */
export function backoffMs(attempts: number): number {
  return Math.min(2000 * Math.pow(2, Math.max(0, attempts - 1)), 5 * 60_000);
}

export function readyOps(queue: QueuedOperation[], now: number, force = false): QueuedOperation[] {
  return queue.filter(
    (o) => (o.status === 'PENDING' || o.status === 'FAILED') && (force || !o.nextAttemptAt || o.nextAttemptAt <= now),
  );
}

function setEntityStatus(state: SyncState, type: EntityType, id: string, status: SyncStatus, version?: number): SyncState {
  if (type === 'MEAL_PLAN') {
    return {
      ...state,
      plans: state.plans.map((p) => (p.id === id ? { ...p, syncStatus: status, version: version ?? p.version } : p)),
    };
  }
  return {
    ...state,
    records: state.records.map((r) => (r.id === id ? { ...r, syncStatus: status, version: version ?? r.version } : r)),
  };
}

export function markSyncing(state: SyncState, opIds: string[]): SyncState {
  let next: SyncState = {
    ...state,
    queue: state.queue.map((o) => (opIds.includes(o.opId) ? { ...o, status: 'SYNCING' as const } : o)),
  };
  for (const o of state.queue.filter((q) => opIds.includes(q.opId))) {
    next = setEntityStatus(next, o.entityType, o.entityId, 'SYNCING');
  }
  return next;
}

/** Status entitas berdasarkan operasi yang masih tersisa di antrean. */
function settleEntity(state: SyncState, type: EntityType, id: string, version?: number): SyncState {
  const remaining = state.queue.filter((o) => o.entityType === type && o.entityId === id);
  if (remaining.length === 0) return setEntityStatus(state, type, id, 'SYNCED', version);
  if (remaining.some((o) => o.status === 'FAILED')) return setEntityStatus(state, type, id, 'FAILED', version);
  return setEntityStatus(state, type, id, 'PENDING', version);
}

export function applyResults(state: SyncState, results: OpResult[], now: number): SyncState {
  let next = state;
  for (const r of results) {
    const op = next.queue.find((o) => o.opId === r.opId);
    if (!op) continue;
    if (r.status === 'ACCEPTED') {
      next = { ...next, queue: next.queue.filter((o) => o.opId !== r.opId) };
      next = settleEntity(next, op.entityType, op.entityId, r.version);
    } else if (r.status === 'RETRYABLE') {
      const attempts = op.attempts + 1;
      next = {
        ...next,
        queue: next.queue.map((o) =>
          o.opId === r.opId ? { ...o, status: 'FAILED' as const, attempts, lastError: r.reason, nextAttemptAt: now + backoffMs(attempts) } : o,
        ),
      };
      next = settleEntity(next, op.entityType, op.entityId);
    } else if (r.status === 'REJECTED') {
      next = {
        ...next,
        queue: next.queue.map((o) => (o.opId === r.opId ? { ...o, status: 'FAILED' as const, lastError: r.reason, attempts: o.attempts + 1 } : o)),
      };
      next = settleEntity(next, op.entityType, op.entityId);
    } else if (r.status === 'CONFLICT') {
      const local = op.payload ?? findEntity(next, op.entityType, op.entityId);
      next = {
        ...next,
        queue: next.queue.map((o) => (o.opId === r.opId ? { ...o, status: 'CONFLICT' as const } : o)),
        conflicts: local ? [...next.conflicts, { opId: r.opId, entityType: op.entityType, local, server: r.server }] : next.conflicts,
      };
      next = setEntityStatus(next, op.entityType, op.entityId, 'PENDING');
    }
  }
  if (next.queue.length === 0) next = { ...next, lastSyncedAt: new Date(now).toISOString() };
  return next;
}

/** Kegagalan jaringan untuk seluruh batch → semua op batch kembali FAILED dengan backoff. */
export function failBatch(state: SyncState, opIds: string[], reason: string, now: number): SyncState {
  return applyResults(
    state,
    opIds.map((opId) => ({ opId, status: 'RETRYABLE' as const, reason })),
    now,
  );
}

export function findEntity(state: SyncState, type: EntityType, id: string) {
  return type === 'MEAL_PLAN' ? state.plans.find((p) => p.id === id) : state.records.find((r) => r.id === id);
}

/** Pengguna memilih versi (O2). Versi server → ganti lokal & buang op; versi lokal → kirim ulang di atas versi server. */
export function resolveConflict(state: SyncState, opId: string, choice: 'LOCAL' | 'SERVER'): SyncState {
  const c = state.conflicts.find((x) => x.opId === opId);
  if (!c) return state;
  let next: SyncState = { ...state, conflicts: state.conflicts.filter((x) => x.opId !== opId) };
  if (choice === 'SERVER') {
    next = replaceEntity(next, c.entityType, { ...c.server, syncStatus: 'SYNCED' });
    next = { ...next, queue: next.queue.filter((o) => o.opId !== opId) };
    return settleEntity(next, c.entityType, c.server.id, c.server.version);
  }
  const rebased = { ...c.local, version: c.server.version } as MealPlanEntry | ConsumptionRecord;
  next = replaceEntity(next, c.entityType, { ...rebased, syncStatus: 'PENDING' });
  next = {
    ...next,
    queue: next.queue.map((o) =>
      o.opId === opId
        ? { ...o, opId: newId('op'), status: 'PENDING' as const, payload: rebased, baseVersion: c.server.version, attempts: 0, nextAttemptAt: undefined }
        : o,
    ),
  };
  return next;
}

export function replaceEntity(state: SyncState, type: EntityType, entity: MealPlanEntry | ConsumptionRecord): SyncState {
  if (type === 'MEAL_PLAN') {
    const e = entity as MealPlanEntry;
    const exists = state.plans.some((p) => p.id === e.id);
    return { ...state, plans: exists ? state.plans.map((p) => (p.id === e.id ? e : p)) : [...state.plans, e] };
  }
  const r = entity as ConsumptionRecord;
  const exists = state.records.some((x) => x.id === r.id);
  return { ...state, records: exists ? state.records.map((x) => (x.id === r.id ? r : x)) : [...state.records, r] };
}

export function removeEntity(state: SyncState, type: EntityType, id: string): SyncState {
  return type === 'MEAL_PLAN'
    ? { ...state, plans: state.plans.filter((p) => p.id !== id) }
    : { ...state, records: state.records.filter((r) => r.id !== id) };
}

/** Status global untuk chip header Beranda. */
export function globalStatus(state: SyncState, syncing: boolean): SyncStatus {
  if (syncing) return 'SYNCING';
  if (state.queue.some((o) => o.status === 'FAILED')) return 'FAILED';
  if (state.queue.length > 0) return 'PENDING';
  return 'SYNCED';
}

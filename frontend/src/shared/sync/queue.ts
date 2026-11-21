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
  serverDeleted?: boolean;
  localDeleted?: boolean;
}

export interface SyncState {
  plans: MealPlanEntry[];
  records: ConsumptionRecord[];
  queue: QueuedOperation[];
  conflicts: ConflictItem[];
  lastSyncedAt: string | null;
  deletedVersions?: Record<string, number>;
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
    previous: op === 'DELETE' ? entity : undefined,
  };
}

/** Backoff eksponensial terbatas: 2s, 4s, 8s … maks 5 menit. */
export function backoffMs(attempts: number): number {
  return Math.min(2000 * Math.pow(2, Math.max(0, attempts - 1)), 5 * 60_000);
}

function entityKey(type: EntityType, id: string): string {
  return `${type}:${id}`;
}

const sameEntity = (a: QueuedOperation, b: QueuedOperation) => a.entityType === b.entityType && a.entityId === b.entityId;

export function readyOps(queue: QueuedOperation[], now: number, force = false): QueuedOperation[] {
  const seen = new Set<string>();
  const newPlans = new Set(queue.filter((op) => op.entityType === 'MEAL_PLAN' && op.op === 'CREATE').map((op) => op.entityId));
  return queue.filter((op) => {
    const key = entityKey(op.entityType, op.entityId);
    if (seen.has(key)) return false;
    seen.add(key);
    if (op.entityType === 'CONSUMPTION' && op.op === 'CREATE' && op.payload && 'snapshot' in op.payload) {
      if (op.payload.planEntryId && newPlans.has(op.payload.planEntryId)) return false;
    }
    if (op.rejected) return false;
    return (op.status === 'PENDING' || op.status === 'FAILED') && (force || !op.nextAttemptAt || op.nextAttemptAt <= now);
  });
}

/** Gabungkan data server tanpa mengganti perubahan atau penghapusan lokal yang masih antre. */
export function mergePull(state: SyncState, remote: Pick<SyncState, 'plans' | 'records'>): SyncState {
  const pending = new Set(state.queue.map((op) => entityKey(op.entityType, op.entityId)));
  const merge = <T extends MealPlanEntry | ConsumptionRecord>(type: EntityType, local: T[], server: T[]) => [
    ...server.filter((entity) => !pending.has(entityKey(type, entity.id))),
    ...local.filter((entity) => pending.has(entityKey(type, entity.id))),
  ];
  return { ...state, plans: merge('MEAL_PLAN', state.plans, remote.plans),
    records: merge('CONSUMPTION', state.records, remote.records), lastSyncedAt: new Date().toISOString() };
}

export function enqueueChange(state: SyncState, type: EntityType, entity: MealPlanEntry | ConsumptionRecord, deleting = false): SyncState {
  const prior = findEntity(state, type, entity.id);
  const first = state.queue.find((op) => op.entityType === type && op.entityId === entity.id);
  const deletedVersion = state.deletedVersions?.[entityKey(type, entity.id)];
  const action = deleting ? 'DELETE' : prior || first || deletedVersion !== undefined ? 'UPDATE' : 'CREATE';
  let op = makeOp(type, action, { ...entity, version: prior?.version ?? deletedVersion ?? entity.version });
  let queue = state.queue;
  if (first?.rejected) {
    queue = queue.filter((queued) => !sameEntity(queued, op));
    if (deleting && first.op === 'CREATE') return { ...removeEntity(state, type, entity.id), queue };
    op = { ...op, op: first.op === 'CREATE' ? 'CREATE' : op.op, baseVersion: first.baseVersion };
  }
  const next = deleting ? removeEntity(state, type, entity.id) : replaceEntity(state, type, entity);
  return { ...next, queue: [...queue, op] };
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
      const queue = next.queue.filter((o) => o.opId !== r.opId);
      const following = queue.findIndex((o) => sameEntity(o, op));
      if (following >= 0) queue[following] = { ...queue[following], baseVersion: r.version };
      const deletedVersions = { ...next.deletedVersions };
      const key = entityKey(op.entityType, op.entityId);
      if (op.op === 'DELETE') deletedVersions[key] = r.version;
      else delete deletedVersions[key];
      next = settleEntity({ ...next, queue, deletedVersions }, op.entityType, op.entityId, r.version);
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
        queue: next.queue.map((o) => (o.opId === r.opId ? { ...o, status: 'FAILED' as const, rejected: true, lastError: r.reason, attempts: o.attempts + 1 } : o)),
      };
      next = settleEntity(next, op.entityType, op.entityId);
    } else if (r.status === 'CONFLICT') {
      const latest = next.queue.filter((queued) => sameEntity(queued, op)).slice(-1)[0];
      const local = latest.payload ?? latest.previous ?? next.conflicts.find((c) => c.opId === r.opId)?.local ?? r.server;
      next = {
        ...next,
        queue: next.queue.map((o) => (o.opId === r.opId ? { ...o, status: 'CONFLICT' as const } : o)),
        conflicts: [...next.conflicts, { opId: r.opId, entityType: op.entityType, local, server: r.server,
          serverDeleted: r.deleted, localDeleted: latest.op === 'DELETE' }],
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
  const { entityType: type, server } = c;
  const latest = state.queue.filter((op) => op.entityType === type && op.entityId === server.id).slice(-1)[0];
  const local = latest?.payload ?? latest?.previous ?? c.local;
  const localDeleted = latest ? latest.op === 'DELETE' : c.localDeleted;
  const key = entityKey(type, server.id);
  const deletedVersions = { ...state.deletedVersions };
  if (c.serverDeleted) deletedVersions[key] = server.version;
  else delete deletedVersions[key];
  const next: SyncState = {
    ...state,
    deletedVersions,
    conflicts: state.conflicts.filter((item) => item.opId !== opId),
    queue: state.queue.filter((op) => op.entityType !== type || op.entityId !== server.id),
  };
  if (choice === 'SERVER') {
    return c.serverDeleted ? removeEntity(next, type, server.id) :
      replaceEntity(next, type, { ...server, syncStatus: 'SYNCED' });
  }
  if (localDeleted && c.serverDeleted) return removeEntity(next, type, server.id);
  const rebased = { ...local, version: server.version, syncStatus: 'PENDING' as const };
  const op = makeOp(type, localDeleted ? 'DELETE' : 'UPDATE', rebased);
  const updated = localDeleted ? removeEntity(next, type, server.id) : replaceEntity(next, type, rebased);
  return { ...updated, queue: [...updated.queue, op] };
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

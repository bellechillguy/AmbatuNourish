/**
 * Sinkronisasi offline untuk Meal Planning & Consumption History (FR-OFF, requirements §7.10).
 * Bentuk antrean, idempotency key, versioning, dan strategi konflik harus disepakati di kontrak
 * backend — tipe di bawah adalah bentuk minimum yang dibutuhkan UI.
 */
import { config } from '../shared/api/config';
import { AppError } from '../shared/api/errors';
import type { ConsumptionRecord, MealPlanEntry } from '../shared/domain/types';
import { buildDemoPlans, buildDemoRecords } from './fixtures';
import { delay, ensureOnline } from './network';

export type EntityType = 'MEAL_PLAN' | 'CONSUMPTION';
export type OpType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface QueuedOperation {
  /** Kunci idempotensi buatan klien. */
  opId: string;
  entityType: EntityType;
  entityId: string;
  op: OpType;
  payload: MealPlanEntry | ConsumptionRecord | null;
  baseVersion: number;
  createdAt: string;
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'CONFLICT';
  attempts: number;
  nextAttemptAt?: number;
  lastError?: string;
}

export type OpResult =
  | { opId: string; status: 'ACCEPTED'; version: number }
  | { opId: string; status: 'REJECTED'; reason: string }
  | { opId: string; status: 'RETRYABLE'; reason: string }
  | { opId: string; status: 'CONFLICT'; server: MealPlanEntry | ConsumptionRecord };

export interface SyncService {
  pull(): Promise<{ plans: MealPlanEntry[]; records: ConsumptionRecord[] }>;
  push(ops: QueuedOperation[]): Promise<OpResult[]>;
}

class HttpSyncService implements SyncService {
  async pull(): Promise<{ plans: MealPlanEntry[]; records: ConsumptionRecord[] }> {
    throw new AppError('CONTRACT_PENDING');
  }
  async push(): Promise<OpResult[]> {
    throw new AppError('CONTRACT_PENDING');
  }
}

/** Mode demo: true → operasi rencana makan berikutnya menghasilkan konflik (O2). */
export const syncDemoFlags = { nextPlanConflict: false, failNext: false };

class MockSyncService implements SyncService {
  /** Mensimulasikan idempotensi server: opId yang sama mengembalikan hasil sebelumnya. */
  private seen = new Map<string, OpResult>();

  async pull() {
    await delay(300);
    ensureOnline();
    return { plans: buildDemoPlans(), records: buildDemoRecords() };
  }

  async push(ops: QueuedOperation[]): Promise<OpResult[]> {
    await delay(900);
    ensureOnline();
    return ops.map((op) => {
      const prior = this.seen.get(op.opId);
      if (prior) return prior;
      let result: OpResult;
      if (syncDemoFlags.failNext) {
        syncDemoFlags.failNext = false;
        result = { opId: op.opId, status: 'RETRYABLE', reason: 'server tidak merespons' };
        return result;
      }
      if (syncDemoFlags.nextPlanConflict && op.entityType === 'MEAL_PLAN' && op.payload) {
        syncDemoFlags.nextPlanConflict = false;
        const local = op.payload as MealPlanEntry;
        result = {
          opId: op.opId,
          status: 'CONFLICT',
          server: { ...local, title: 'Nasi merah, ayam panggang, salad', version: local.version + 1, syncStatus: 'SYNCED' },
        };
      } else {
        result = { opId: op.opId, status: 'ACCEPTED', version: op.baseVersion + 1 };
      }
      this.seen.set(op.opId, result);
      return result;
    });
  }
}

export const syncService: SyncService = config.useMock ? new MockSyncService() : new HttpSyncService();

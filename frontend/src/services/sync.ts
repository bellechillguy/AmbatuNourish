/**
 * Sinkronisasi offline untuk Meal Planning & Consumption History (FR-OFF, requirements §7.10).
 */
import { config } from '../shared/api/config';
import { request } from '../shared/api/ApiService';
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
  rejected?: boolean;
  previous?: MealPlanEntry | ConsumptionRecord;
}

export type OpResult =
  | { opId: string; status: 'ACCEPTED'; version: number }
  | { opId: string; status: 'REJECTED'; reason: string }
  | { opId: string; status: 'RETRYABLE'; reason: string }
  | { opId: string; status: 'CONFLICT'; server: MealPlanEntry | ConsumptionRecord; deleted?: boolean };

export interface SyncService {
  pull(): Promise<{ plans: MealPlanEntry[]; records: ConsumptionRecord[] }>;
  push(ops: QueuedOperation[]): Promise<OpResult[]>;
}

class HttpSyncService implements SyncService {
  pull(): Promise<{ plans: MealPlanEntry[]; records: ConsumptionRecord[] }> {
    return request('/sync');
  }

  push(ops: QueuedOperation[]): Promise<OpResult[]> {
    const operations = ops.map(({ opId, entityType, entityId, op, baseVersion, payload }) => ({
      opId, entityType, entityId, op, baseVersion, payload,
    }));
    return request('/sync', { method: 'POST', body: { operations } });
  }
}

/** Mode demo: true → operasi rencana makan berikutnya menghasilkan konflik (O2). */
export const syncDemoFlags = { nextPlanConflict: false, failNext: false };

class MockSyncService implements SyncService {
  private plans = buildDemoPlans();
  private records = buildDemoRecords();
  /** Mensimulasikan idempotensi server: opId yang sama mengembalikan hasil sebelumnya. */
  private seen = new Map<string, OpResult>();

  async pull() {
    await delay(300);
    ensureOnline();
    return { plans: this.plans.slice(), records: this.records.slice() };
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
        const server = { ...local, title: 'Nasi merah, ayam panggang, salad', version: local.version + 1, syncStatus: 'SYNCED' as const };
        this.plans = [...this.plans.filter((plan) => plan.id !== local.id), server];
        result = { opId: op.opId, status: 'CONFLICT', server };
      } else {
        const version = op.baseVersion + 1;
        const payload = op.payload ? { ...op.payload, version, syncStatus: 'SYNCED' as const } : null;
        if (op.entityType === 'MEAL_PLAN') {
          this.plans = this.plans.filter((plan) => plan.id !== op.entityId);
          if (payload && 'slot' in payload) this.plans.push(payload);
        } else {
          this.records = this.records.filter((record) => record.id !== op.entityId);
          if (payload && 'snapshot' in payload) this.records.push(payload);
        }
        result = { opId: op.opId, status: 'ACCEPTED', version };
      }
      this.seen.set(op.opId, result);
      return result;
    });
  }
}

export const syncService: SyncService = config.useMock ? new MockSyncService() : new HttpSyncService();

import { emptyFacts } from '../shared/domain/nutrients';
import type { ConsumptionRecord } from '../shared/domain/types';
import { applyResults, backoffMs, emptySyncState, makeOp, markSyncing, readyOps, resolveConflict } from '../shared/sync/queue';

const record: ConsumptionRecord = {
  id: 'rec-1',
  consumedAt: new Date().toISOString(),
  title: 'Susu',
  source: 'SCAN',
  quantity: 200,
  unit: 'ml',
  itemsCount: 1,
  snapshot: emptyFacts(),
  syncStatus: 'LOCAL',
  version: 0,
};

function stateWithOp() {
  const op = makeOp('CONSUMPTION', 'CREATE', record);
  return { op, state: { ...emptySyncState, records: [record], queue: [op] } };
}

describe('antrean sinkronisasi offline', () => {
  it('setiap operasi punya kunci idempotensi unik', () => {
    const a = makeOp('CONSUMPTION', 'CREATE', record);
    const b = makeOp('CONSUMPTION', 'CREATE', record);
    expect(a.opId).not.toBe(b.opId);
  });

  it('ditandai tersinkron hanya setelah konfirmasi backend', () => {
    const { op, state } = stateWithOp();
    const syncing = markSyncing(state, [op.opId]);
    expect(syncing.records[0].syncStatus).toBe('SYNCING');
    const done = applyResults(syncing, [{ opId: op.opId, status: 'ACCEPTED', version: 1 }], Date.now());
    expect(done.queue).toHaveLength(0);
    expect(done.records[0].syncStatus).toBe('SYNCED');
    expect(done.records[0].version).toBe(1);
  });

  it('kegagalan sementara memakai backoff dan tidak menghapus data', () => {
    const { op, state } = stateWithOp();
    const now = Date.now();
    const failed = applyResults(state, [{ opId: op.opId, status: 'RETRYABLE', reason: 'timeout' }], now);
    expect(failed.records[0].syncStatus).toBe('FAILED');
    expect(failed.queue[0].attempts).toBe(1);
    expect(readyOps(failed.queue, now)).toHaveLength(0);
    expect(readyOps(failed.queue, now + backoffMs(1) + 1)).toHaveLength(1);
    expect(backoffMs(50)).toBe(5 * 60_000);
  });

  it('konflik tidak menimpa diam-diam; pengguna memilih versi', () => {
    const { op, state } = stateWithOp();
    const server = { ...record, title: 'Versi server', version: 3, syncStatus: 'SYNCED' as const };
    const conflicted = applyResults(state, [{ opId: op.opId, status: 'CONFLICT', server }], Date.now());
    expect(conflicted.conflicts).toHaveLength(1);
    expect(conflicted.records[0].title).toBe('Susu');

    const keepServer = resolveConflict(conflicted, op.opId, 'SERVER');
    expect(keepServer.records[0].title).toBe('Versi server');
    expect(keepServer.queue).toHaveLength(0);

    const keepLocal = resolveConflict(conflicted, op.opId, 'LOCAL');
    expect(keepLocal.records[0].title).toBe('Susu');
    expect(keepLocal.queue[0].baseVersion).toBe(3);
    expect(keepLocal.queue[0].status).toBe('PENDING');
  });
});

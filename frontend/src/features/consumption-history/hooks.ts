import { useMemo } from 'react';

import { buildDailySummary, incompleteRecordCount } from '../../shared/domain/summary';
import { config } from '../../shared/api/config';
import { useConnectivity } from '../../shared/state/ConnectivityProvider';
import { useAsync } from '../../shared/state/useAsync';
import { useOfflineData } from '../../shared/sync/OfflineDataProvider';
import { consumptionService } from '../../services/consumption';
import { toDateKey } from '../../shared/utils/date';

/** Target harian (Nutrition Plan / target pengguna). Kosong → tanpa progress indicator. */
export function useDailyTargets() {
  return useAsync(() => consumptionService.getDailyTargets(), []);
}

/** Gunakan agregat server ketika sinkron, dan hitung dari perangkat untuk perubahan offline. */
export function useDailySummary(date: string) {
  const { records, queueSize, lastSyncedAt } = useOfflineData();
  const { online } = useConnectivity();
  const eligible = !config.useMock && online && queueSize === 0 && !!lastSyncedAt;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const remote = useAsync(
    () => consumptionService.getDailySummary(date, timezone).then((data) => ({ data, lastSyncedAt })),
    [date, timezone, eligible, lastSyncedAt],
    { enabled: eligible },
  );
  const targets = useDailyTargets();
  const summary = useMemo(() => buildDailySummary(records, date, targets.data ?? {}), [records, date, targets.data]);
  const incomplete = useMemo(() => incompleteRecordCount(records, date), [records, date]);
  const dayRecords = useMemo(
    () =>
      records
        .filter((r) => toDateKey(new Date(r.consumedAt)) === date)
        .sort((a, b) => b.consumedAt.localeCompare(a.consumedAt)),
    [records, date],
  );
  const synced = eligible && !remote.loading && !remote.error && remote.data?.lastSyncedAt === lastSyncedAt &&
    remote.data?.data?.date === date && remote.data.data.recordCount === dayRecords.length ? remote.data.data : null;
  return { summary: synced ?? summary, incomplete: synced?.incompleteCount ?? incomplete, dayRecords, targetsLoading: targets.loading };
}

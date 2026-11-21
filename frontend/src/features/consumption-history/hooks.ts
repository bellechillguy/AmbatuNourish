import { useMemo } from 'react';

import { buildDailySummary, incompleteRecordCount } from '../../shared/domain/summary';
import { useAsync } from '../../shared/state/useAsync';
import { useOfflineData } from '../../shared/sync/OfflineDataProvider';
import { consumptionService } from '../../services/consumption';
import { toDateKey } from '../../shared/utils/date';

/** Target harian (Nutrition Plan / target pengguna). Kosong → tanpa progress indicator. */
export function useDailyTargets() {
  return useAsync(() => consumptionService.getDailyTargets(), []);
}

/** Ringkasan harian dari Catatan Konsumsi lokal (sumber kebenaran di perangkat). */
export function useDailySummary(date: string) {
  const { records } = useOfflineData();
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
  return { summary, incomplete, dayRecords, targetsLoading: targets.loading };
}

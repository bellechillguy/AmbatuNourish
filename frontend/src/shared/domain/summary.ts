import { SUMMARY_METRICS } from './nutrients';
import type { ConsumptionRecord, DailySummary, SummaryMetric, SummaryTarget } from './types';
import { toDateKey } from '../utils/date';

/**
 * Agregasi Ringkasan Gizi harian dari Catatan Konsumsi (bukan rencana).
 * Nilai yang hilang TIDAK dianggap nol: totals hanya menjumlah nilai diketahui,
 * dan missingCount mencatat berapa catatan yang tidak memiliki nilai tsb (FR-SUM-08).
 * Aturan penjumlahan parsial final mengikuti backend (PROPOSED di handoff).
 */
export function buildDailySummary(
  records: ConsumptionRecord[],
  date: string,
  targets: Partial<Record<SummaryMetric, SummaryTarget>>,
): DailySummary {
  const dayRecords = records.filter((r) => toDateKey(new Date(r.consumedAt)) === date);
  const totals = {} as Record<SummaryMetric, number>;
  const missingCount = {} as Record<SummaryMetric, number>;
  for (const m of SUMMARY_METRICS) {
    totals[m] = 0;
    missingCount[m] = 0;
    for (const r of dayRecords) {
      const v = r.snapshot[m];
      if (v === null || v === undefined) missingCount[m] += 1;
      else totals[m] += v;
    }
  }
  return { date, recordCount: dayRecords.length, totals, missingCount, targets };
}

/** Jumlah catatan yang memiliki minimal satu nilai metrik hilang. */
export function incompleteRecordCount(records: ConsumptionRecord[], date: string): number {
  return records
    .filter((r) => toDateKey(new Date(r.consumedAt)) === date)
    .filter((r) => SUMMARY_METRICS.some((m) => r.snapshot[m] === null || r.snapshot[m] === undefined)).length;
}

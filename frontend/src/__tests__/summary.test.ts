import { emptyFacts } from '../shared/domain/nutrients';
import { buildDailySummary, incompleteRecordCount } from '../shared/domain/summary';
import type { ConsumptionRecord } from '../shared/domain/types';
import { toDateKey } from '../shared/utils/date';

const rec = (id: string, energy: number | null, sodium: number | null): ConsumptionRecord => ({
  id,
  consumedAt: new Date().toISOString(),
  title: id,
  source: 'SEARCH',
  quantity: 100,
  unit: 'g',
  itemsCount: 1,
  snapshot: { ...emptyFacts(), energy, sodium, protein: 1, carbohydrate: 1, sugar: 1, fat: 1 },
  syncStatus: 'SYNCED',
  version: 1,
});

describe('Ringkasan Gizi harian', () => {
  const today = toDateKey(new Date());

  it('tidak menganggap nilai hilang sebagai nol dan mencatat jumlah yang hilang', () => {
    const s = buildDailySummary([rec('a', 100, 50), rec('b', 200, null)], today, {});
    expect(s.totals.energy).toBe(300);
    expect(s.totals.sodium).toBe(50);
    expect(s.missingCount.sodium).toBe(1);
    expect(s.recordCount).toBe(2);
  });

  it('menghitung catatan tidak lengkap', () => {
    expect(incompleteRecordCount([rec('a', 100, 50), rec('b', 200, null)], today)).toBe(1);
  });

  it('hari tanpa catatan → recordCount 0 (bukan "0 kkal dimakan")', () => {
    const s = buildDailySummary([], today, {});
    expect(s.recordCount).toBe(0);
  });
});

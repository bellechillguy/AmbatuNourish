/**
 * Consumption History (supporting) — target harian untuk progress indicator Ringkasan.
 * Catatan konsumsi sendiri dikelola offline-first (OfflineDataProvider + sync).
 */
import { config } from '../shared/api/config';
import type { SummaryMetric, SummaryTarget } from '../shared/domain/types';
import { demoPlanRules } from './fixtures';
import { delay } from './network';

export interface ConsumptionService {
  /** Target harian dari Nutrition Plan aktif atau target pengguna. Kosong = tanpa target (L2). */
  getDailyTargets(): Promise<Partial<Record<SummaryMetric, SummaryTarget>>>;
}

class HttpConsumptionService implements ConsumptionService {
  async getDailyTargets() {
    // Kontrak target (Nutrition Plan Ambatufit) masih PENDING → tanpa target, tanpa progress indicator.
    return {};
  }
}

class MockConsumptionService implements ConsumptionService {
  /** Demo: setel ke false untuk melihat L2 (tanpa target). */
  hasPlan = true;
  async getDailyTargets() {
    await delay(150);
    if (!this.hasPlan) return {};
    const t = demoPlanRules.dailyTargets;
    const out: Partial<Record<SummaryMetric, SummaryTarget>> = {};
    (Object.keys(t) as SummaryMetric[]).forEach((k) => (out[k] = { value: t[k], source: 'NUTRITION_PLAN' }));
    return out;
  }
}

export const consumptionService: ConsumptionService = config.useMock ? new MockConsumptionService() : new HttpConsumptionService();

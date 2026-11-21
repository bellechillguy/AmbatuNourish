/**
 * Nutritional Assessment (core). Formula, bobot, dan ambang adalah milik service (FR-ASMT-15).
 * UI hanya menampilkan hasil + bukti yang dikembalikan service.
 *
 * MockAssessmentService di bawah adalah STAND-IN backend untuk mode demo saja: ia menerapkan
 * aturan contoh (batas preferensi & plan contoh di fixtures) agar alur F1→F2/F3/F4 dapat dicoba.
 * Ini BUKAN algoritma domain final dan tidak dipakai saat USE_MOCK=false.
 */
import { config } from '../shared/api/config';
import { AppError } from '../shared/api/errors';
import { request } from '../shared/api/http';
import { NUTRIENT_LABEL, scaleValue } from '../shared/domain/nutrients';
import type {
  Assessment,
  ComparisonColumn,
  EvidenceItem,
  NutritionPlan,
  Portion,
  Preference,
  Product,
  RuleConflict,
} from '../shared/domain/types';
import { formatNumber } from '../shared/utils/format';
import { demoNutritionPlan, demoPlanRules, demoPreferences, demoProducts } from './fixtures';
import { delay, ensureOnline, isOnline } from './network';

export interface AssessmentService {
  assessProduct(productId: string, portion: Portion): Promise<Assessment>;
  compare(productIds: string[]): Promise<ComparisonColumn[]>;
  getPreferences(): Promise<Preference[]>;
  savePreference(pref: Preference): Promise<Preference>;
  deletePreference(id: string): Promise<void>;
  getNutritionPlan(): Promise<NutritionPlan | null>;
  getConflicts(): Promise<RuleConflict[]>;
}

/* ---------- HTTP — kontrak PENDING ---------- */

class HttpAssessmentService implements AssessmentService {
  private pending(): never {
    throw new AppError('CONTRACT_PENDING');
  }
  async assessProduct(): Promise<Assessment> {
    return this.pending();
  }
  async compare(): Promise<ComparisonColumn[]> {
    return this.pending();
  }
  async getPreferences(): Promise<Preference[]> {
    return this.pending();
  }
  async savePreference(): Promise<Preference> {
    return this.pending();
  }
  async deletePreference(): Promise<void> {
    return this.pending();
  }
  async getNutritionPlan(): Promise<NutritionPlan | null> {
    // Nutrition Plan diterima backend dari Ambatufit (server-to-server), lalu dibaca mobile.
    return this.pending();
  }
  async getConflicts(): Promise<RuleConflict[]> {
    return this.pending();
  }
}
void request; // klien HTTP siap dipakai saat kontrak tersedia

/* ---------- Mock (DEMO) ---------- */

class MockAssessmentService implements AssessmentService {
  private prefs: Preference[] = demoPreferences.map((p) => ({ ...p, ingredients: p.ingredients?.slice() }));

  async assessProduct(productId: string, portion: Portion): Promise<Assessment> {
    await delay(500);
    ensureOnline();
    const product = demoProducts.find((p) => p.id === productId);
    if (!product) throw new AppError('NOT_FOUND');
    return evaluate(product, portion, this.prefs);
  }

  async compare(productIds: string[]): Promise<ComparisonColumn[]> {
    await delay(300);
    return productIds
      .map((id) => demoProducts.find((p) => p.id === id))
      .filter((p): p is Product => !!p)
      .map((p) => {
        const defaultPortion = p.serving ? { quantity: p.serving.quantity, unit: p.serving.unit } : null;
        return {
          productId: p.id,
          name: p.name,
          brand: p.brand,
          basis: p.basis,
          source: p.source,
          completeness: p.completeness,
          verification: p.verification,
          values: p.nutrientsPer100,
          outcome: defaultPortion ? evaluate(p, defaultPortion, this.prefs).outcome : undefined,
        };
      });
  }

  async getPreferences(): Promise<Preference[]> {
    await delay(200);
    return this.prefs.map((p) => ({ ...p }));
  }

  async savePreference(pref: Preference): Promise<Preference> {
    await delay();
    ensureOnline();
    const idx = this.prefs.findIndex((p) => p.id === pref.id);
    if (idx >= 0) this.prefs[idx] = pref;
    else this.prefs.push(pref);
    return pref;
  }

  async deletePreference(id: string): Promise<void> {
    await delay();
    ensureOnline();
    const idx = this.prefs.findIndex((p) => p.id === id);
    if (idx >= 0) this.prefs[idx] = { ...this.prefs[idx], value: null, ingredients: this.prefs[idx].ingredients ? [] : undefined };
  }

  async getNutritionPlan(): Promise<NutritionPlan | null> {
    await delay(250);
    // Mitra tidak terjangkau → tampilkan cache + penanda (H3), tidak pernah kosong.
    if (!isOnline()) return { ...demoNutritionPlan, isStale: true };
    return { ...demoNutritionPlan, checkedAt: new Date().toISOString() };
  }

  async getConflicts(): Promise<RuleConflict[]> {
    await delay(150);
    const sodium = this.prefs.find((p) => p.type === 'SODIUM_MAX_PER_PORTION');
    if (sodium?.value != null && sodium.value !== demoPlanRules.sodiumMaxPerPortion) {
      return [
        {
          id: 'conflict-sodium',
          preferenceId: sodium.id,
          nutrientLabel: 'natrium',
          preferenceLabel: `≤ ${formatNumber(sodium.value)} mg`,
          planLabel: `≤ ${formatNumber(demoPlanRules.sodiumMaxPerPortion)} mg`,
        },
      ];
    }
    return [];
  }
}

/** Evaluasi contoh — cerminan aturan status gabungan §5.3.1 (PROPOSED). */
function evaluate(product: Product, portion: Portion, prefs: Preference[]): Assessment {
  const evidence: EvidenceItem[] = [];
  const unitLabel = `${formatNumber(portion.quantity)} ${portion.unit}`;

  const limitRule = (key: 'sugar' | 'sodium', limit: number, unit: 'g' | 'mg', source: EvidenceItem['source']) => {
    const v = scaleValue(product.nutrientsPer100[key], portion.quantity);
    const label = NUTRIENT_LABEL[key];
    const rule = `${label} per porsi ≤ ${formatNumber(limit)} ${unit}`;
    if (v === null) {
      evidence.push({ rule, source, observed: null, nutrientLabel: label, result: 'UNKNOWN', resultLabel: 'Tidak dapat diperiksa' });
      return;
    }
    const observed = `${label} ${unit === 'g' ? v.toFixed(1).replace('.', ',') : formatNumber(v, 0)} ${unit}`;
    const ok = v <= limit;
    evidence.push({
      rule,
      source,
      observed,
      result: ok ? 'MET' : 'VIOLATED',
      resultLabel: ok ? 'Sesuai' : source === 'PREFERENCE' ? 'Melebihi batas Anda' : 'Melebihi batas plan',
    });
  };

  const sugar = prefs.find((p) => p.type === 'SUGAR_MAX_PER_PORTION');
  if (sugar?.value != null) limitRule('sugar', sugar.value, 'g', 'PREFERENCE');
  limitRule('sodium', demoPlanRules.sodiumMaxPerPortion, 'mg', 'NUTRITION_PLAN');
  const sodiumPref = prefs.find((p) => p.type === 'SODIUM_MAX_PER_PORTION');
  if (sodiumPref?.value != null) limitRule('sodium', sodiumPref.value, 'mg', 'PREFERENCE');

  const avoid = prefs.find((p) => p.type === 'AVOID_INGREDIENTS');
  for (const ing of avoid?.ingredients ?? []) {
    const rule = `Hindari: ${ing.toLowerCase()}`;
    if (!product.ingredientsText) {
      evidence.push({ rule, source: 'PREFERENCE', observed: null, nutrientLabel: 'Komposisi', result: 'UNKNOWN', resultLabel: 'Tidak dapat diperiksa' });
    } else {
      const found = product.ingredientsText.toLowerCase().includes(ing.toLowerCase());
      evidence.push({
        rule,
        source: 'PREFERENCE',
        observed: found ? 'Tercantum di komposisi' : 'Tidak tercantum di komposisi',
        result: found ? 'VIOLATED' : 'MET',
        resultLabel: found ? 'Ingin Anda hindari' : 'Sesuai',
      });
    }
  }

  const violated = evidence.filter((e) => e.result === 'VIOLATED').length;
  const unknown = evidence.filter((e) => e.result === 'UNKNOWN');
  const total = evidence.length;

  if (total === 0) {
    return {
      outcome: 'BELUM_DAPAT_DINILAI',
      summary: 'Belum ada batasan untuk dinilai. Atur Profil Preferensi.',
      portion,
      completeness: product.completeness,
      evidence,
    };
  }
  if (violated > 0) {
    return {
      outcome: 'KURANG_COCOK',
      summary: `${violated} dari ${total} batasan tidak terpenuhi untuk porsi ${unitLabel}.`,
      portion,
      completeness: product.completeness,
      evidence,
    };
  }
  if (unknown.length > 0) {
    const names = unknown.map((u) => (u.nutrientLabel ?? '').toLowerCase()).filter((v, i, a) => v && a.indexOf(v) === i);
    return {
      outcome: 'BELUM_DAPAT_DINILAI',
      summary: `Nilai ${names.join(' dan ')} tidak tersedia, padahal batasan Anda memerlukannya. Kami tidak menebak nilai yang hilang.`,
      portion,
      completeness: product.completeness === 'COMPLETE' ? 'INCOMPLETE' : product.completeness,
      evidence,
    };
  }
  return {
    outcome: 'COCOK',
    summary: `Semua batasan yang berlaku terpenuhi untuk porsi ${unitLabel}.`,
    portion,
    completeness: product.completeness,
    evidence,
  };
}

export const assessmentService: AssessmentService = config.useMock ? new MockAssessmentService() : new HttpAssessmentService();

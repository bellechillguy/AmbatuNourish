import type { FoodBasis, MealSlot, NutrientFacts, NutrientKey, NutrientValue, QuantityUnit, SummaryMetric } from './types';

export const NUTRIENT_LABEL: Record<NutrientKey, string> = {
  energy: 'Energi',
  protein: 'Protein',
  carbohydrate: 'Karbohidrat',
  fat: 'Lemak total',
  sugar: 'Gula',
  sodium: 'Natrium',
  transFat: 'Lemak trans',
  fiber: 'Serat pangan',
};

export const NUTRIENT_UNIT: Record<NutrientKey, 'kkal' | 'g' | 'mg'> = {
  energy: 'kkal',
  protein: 'g',
  carbohydrate: 'g',
  fat: 'g',
  sugar: 'g',
  sodium: 'mg',
  transFat: 'g',
  fiber: 'g',
};

/** Kata satuan untuk label aksesibilitas. */
export const UNIT_SPOKEN: Record<string, string> = {
  kkal: 'kilokalori',
  g: 'gram',
  mg: 'miligram',
  ml: 'mililiter',
};

export const SUMMARY_METRICS: SummaryMetric[] = ['energy', 'protein', 'carbohydrate', 'sugar', 'fat', 'sodium'];

export const SLOT_ORDER: MealSlot[] = ['SARAPAN', 'MAKAN_SIANG', 'MAKAN_MALAM', 'CAMILAN'];

/** Label slot PROPOSED (requirements §5.3.6) — dapat dikonfigurasi. */
export const SLOT_LABEL: Record<MealSlot, string> = {
  SARAPAN: 'Sarapan',
  MAKAN_SIANG: 'Makan Siang',
  MAKAN_MALAM: 'Makan Malam',
  CAMILAN: 'Camilan',
};

/** Label pendek untuk matriks mingguan J2. */
export const SLOT_SHORT: Record<MealSlot, string> = {
  SARAPAN: 'Sarapan',
  MAKAN_SIANG: 'Siang',
  MAKAN_MALAM: 'Malam',
  CAMILAN: 'Camilan',
};

export const basisUnit = (basis: FoodBasis): QuantityUnit => (basis === 'MASS' ? 'g' : 'ml');

/** Fakta gizi kosong — semua TIDAK DIKETAHUI (bukan nol). */
export function emptyFacts(): NutrientFacts {
  return {
    energy: null,
    protein: null,
    carbohydrate: null,
    fat: null,
    sugar: null,
    sodium: null,
    transFat: null,
    fiber: null,
  };
}

/**
 * Normalisasi tampilan dari basis per-100 ke kuantitas porsi (BR-02).
 * Unknown tetap unknown. Dipakai untuk menampilkan kolom porsi dan pratinjau snapshot;
 * penilaian kesesuaian TIDAK dihitung di UI (FR-ASMT-15).
 */
export function scaleValue(per100: NutrientValue, quantity: number): NutrientValue {
  if (per100 === null) return null;
  return (per100 * quantity) / 100;
}

export function scaleFacts(per100: NutrientFacts, quantity: number): NutrientFacts {
  const out = emptyFacts();
  (Object.keys(out) as NutrientKey[]).forEach((k) => {
    out[k] = scaleValue(per100[k], quantity);
  });
  return out;
}

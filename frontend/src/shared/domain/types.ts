/**
 * DTO yang dikonsumsi UI. Mengikuti model kanonik AmbatuNourish (requirements §5, §7.4),
 * BUKAN payload mentah Open Food Facts / mitra.
 *
 * Aturan penting:
 *  - `null` pada nilai gizi = TIDAK DIKETAHUI ("Tidak tersedia"), berbeda dengan 0 (BR-03).
 *  - Basis kanonik per 100 g (MASS) atau per 100 ml (VOLUME) (BR-01).
 */

/* ---------- Food Catalog ---------- */

export type NutrientKey =
  | 'energy'
  | 'protein'
  | 'carbohydrate'
  | 'fat'
  | 'sugar'
  | 'sodium'
  | 'transFat'
  | 'fiber';

/** number = nilai diketahui (0 termasuk), null = tidak diketahui. */
export type NutrientValue = number | null;
export type NutrientFacts = Record<NutrientKey, NutrientValue>;

export type FoodBasis = 'MASS' | 'VOLUME';
export type QuantityUnit = 'g' | 'ml';

export type ProductSource = 'OPEN_FOOD_FACTS' | 'USER_ENTERED';
export type VerificationState = 'VERIFIED' | 'UNVERIFIED';
export type Completeness = 'COMPLETE' | 'INCOMPLETE' | 'INSUFFICIENT';

export interface ServingSize {
  quantity: number;
  unit: QuantityUnit;
  /** Teks sajian dari sumber, mis. "per bungkus". */
  sourceText?: string;
}

export interface Product {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  basis: FoodBasis;
  /** Hanya bila sumber mencantumkan & konversinya valid (FR-ASMT-04). */
  serving?: ServingSize;
  nutrientsPer100: NutrientFacts;
  /** Nutrien yang ditampilkan di tabel utama, berurutan. */
  displayNutrients: NutrientKey[];
  ingredientsText?: string;
  allergens?: string[];
  source: ProductSource;
  verification: VerificationState;
  completeness: Completeness;
  missingFields: NutrientKey[];
  /** ISO timestamp penyegaran terakhir dari sumber. */
  fetchedAt?: string;
  createdAt?: string;
  /** true bila disajikan dari cache melewati jendela kesegaran (diisi backend / cache). */
  isStale?: boolean;
}

export interface ProductSummary {
  id: string;
  name: string;
  brand?: string;
  sizeLabel?: string;
  source: ProductSource;
  completeness: Completeness;
  verification: VerificationState;
}

export interface ManualProductInput {
  name: string;
  brand?: string;
  barcode?: string;
  basis: FoodBasis;
  serving?: ServingSize;
  nutrientsPer100: Partial<NutrientFacts>;
}

/* ---------- Nutritional Assessment ---------- */

export type AssessmentOutcome = 'COCOK' | 'KURANG_COCOK' | 'BELUM_DAPAT_DINILAI';
export type RuleSource = 'PREFERENCE' | 'NUTRITION_PLAN';
export type RuleResult = 'MET' | 'VIOLATED' | 'UNKNOWN';

export interface EvidenceItem {
  /** Teks aturan, mis. "Gula per porsi ≤ 12 g" — berasal dari service. */
  rule: string;
  source: RuleSource;
  /** Nilai teramati pada porsi, mis. "Gula 10,0 g". null = tidak tersedia. */
  observed: string | null;
  /** Label nutrien untuk kalimat "X tidak tersedia". */
  nutrientLabel?: string;
  result: RuleResult;
  resultLabel: string;
}

export interface Portion {
  quantity: number;
  unit: QuantityUnit;
}

export interface Assessment {
  outcome: AssessmentOutcome;
  summary: string;
  portion: Portion;
  completeness: Completeness;
  evidence: EvidenceItem[];
}

export type PreferenceType = 'SUGAR_MAX_PER_PORTION' | 'SODIUM_MAX_PER_PORTION' | 'AVOID_INGREDIENTS';

export interface Preference {
  id: string;
  type: PreferenceType;
  label: string;
  /** null = "Belum diatur" */
  value: number | null;
  unit?: 'g' | 'mg';
  ingredients?: string[];
}

export interface NutritionPlanTarget {
  key: string;
  label: string;
  valueLabel: string;
}

export interface NutritionPlan {
  sourceName: 'Ambatufit';
  receivedAt: string;
  checkedAt: string;
  targets: NutritionPlanTarget[];
  /** Plan disajikan dari cache karena mitra tidak terjangkau. */
  isStale?: boolean;
}

export interface RuleConflict {
  id: string;
  preferenceId: string;
  nutrientLabel: string;
  preferenceLabel: string;
  planLabel: string;
}

export interface ComparisonColumn {
  productId: string;
  name: string;
  brand?: string;
  basis: FoodBasis;
  source: ProductSource;
  completeness: Completeness;
  verification: VerificationState;
  values: Record<NutrientKey, NutrientValue>;
  outcome?: AssessmentOutcome;
}

/* ---------- Meal Planning ---------- */

export type MealSlot = 'SARAPAN' | 'MAKAN_SIANG' | 'MAKAN_MALAM' | 'CAMILAN';

export interface MealItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: QuantityUnit;
  source: ProductSource;
}

export interface FavoriteMeal {
  id: string;
  name: string;
  slotHint?: MealSlot;
  items: MealItem[];
  note?: string;
  outcome?: AssessmentOutcome;
  completeness: Completeness;
  totals: Partial<NutrientFacts>;
}

export type SyncStatus = 'LOCAL' | 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface MealPlanEntry {
  id: string;
  /** YYYY-MM-DD (tanggal lokal) */
  date: string;
  slot: MealSlot;
  title: string;
  favoriteId?: string;
  items: MealItem[];
  status: 'PLANNED' | 'CONSUMED';
  consumedAt?: string;
  outcome?: AssessmentOutcome;
  syncStatus: SyncStatus;
  version: number;
}

export interface Restaurant {
  id: string;
  name: string;
  distanceLabel?: string;
  address?: string;
  matchedMenu?: string;
}

/* ---------- Consumption History ---------- */

export type LogSource = 'SCAN' | 'SEARCH' | 'MANUAL' | 'FAVORITE' | 'PLAN';

export interface ConsumptionRecord {
  id: string;
  /** ISO timestamp waktu konsumsi (tidak boleh di masa depan). */
  consumedAt: string;
  title: string;
  productId?: string;
  favoriteId?: string;
  planEntryId?: string;
  source: LogSource;
  quantity: number;
  unit: QuantityUnit;
  itemsCount: number;
  /** Salinan gizi saat dicatat (BR-09) — tidak berubah karena katalog berubah. */
  snapshot: NutrientFacts;
  syncStatus: SyncStatus;
  version: number;
}

export type SummaryMetric = 'energy' | 'protein' | 'carbohydrate' | 'sugar' | 'fat' | 'sodium';

export interface SummaryTarget {
  value: number;
  source: 'NUTRITION_PLAN' | 'USER';
}

export interface DailySummary {
  date: string;
  recordCount: number;
  totals: Record<SummaryMetric, number>;
  /** Jumlah catatan yang tidak memiliki nilai untuk nutrien tsb. */
  missingCount: Record<SummaryMetric, number>;
  targets: Partial<Record<SummaryMetric, SummaryTarget>>;
}

/* ---------- Identity ---------- */

export interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export interface Session {
  token: string;
  user: UserProfile;
}

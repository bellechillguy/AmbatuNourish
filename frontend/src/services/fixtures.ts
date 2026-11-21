/**
 * ⚠️ DATA CONTOH (DEMO) — hanya dipakai saat EXPO_PUBLIC_USE_MOCK=true.
 * Nama produk/merek FIKTIF mengikuti contoh Hi-Fi Figma. Bukan data backend dan
 * tidak boleh ditampilkan sebagai hasil nyata. Ambang batas di bawah adalah contoh
 * nilai preferensi/plan pengguna, BUKAN default domain.
 */
import type {
  ConsumptionRecord,
  FavoriteMeal,
  MealPlanEntry,
  NutrientFacts,
  NutritionPlan,
  Preference,
  Product,
} from '../shared/domain/types';
import { emptyFacts, scaleFacts } from '../shared/domain/nutrients';
import { addDays, todayKey } from '../shared/utils/date';

const facts = (f: Partial<NutrientFacts>): NutrientFacts => ({ ...emptyFacts(), ...f });

const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export const DEMO_BARCODE_NOT_FOUND = '8991234567890';

export const demoProducts: Product[] = [
  {
    id: 'p-susu-cokelat',
    name: 'Susu UHT Cokelat Rendah Gula',
    brand: 'Sapi Rimba',
    barcode: '8990001112223',
    basis: 'VOLUME',
    serving: { quantity: 200, unit: 'ml', sourceText: 'kemasan 200 ml' },
    nutrientsPer100: facts({ energy: 62, protein: 3.2, carbohydrate: 9.8, sugar: 5, fat: 1.2, sodium: 45, transFat: 0, fiber: 0.4 }),
    displayNutrients: ['energy', 'protein', 'sugar', 'fat', 'sodium'],
    ingredientsText: 'Susu sapi segar, air, bubuk kakao, gula, penstabil nabati.',
    allergens: ['Susu'],
    source: 'OPEN_FOOD_FACTS',
    verification: 'VERIFIED',
    completeness: 'COMPLETE',
    missingFields: [],
    fetchedAt: daysAgoIso(9),
  },
  {
    id: 'p-biskuit-utuh',
    name: 'Biskuit Gandum Utuh',
    brand: 'Lumbung',
    barcode: '8990002223334',
    basis: 'MASS',
    serving: { quantity: 30, unit: 'g', sourceText: 'per sajian' },
    nutrientsPer100: facts({ energy: 452, protein: 8.1, carbohydrate: 68, sugar: 16, fat: 17, transFat: 0, sodium: null, fiber: null }),
    displayNutrients: ['energy', 'sugar', 'transFat', 'sodium', 'fiber'],
    ingredientsText: 'Tepung gandum utuh, gula, minyak sawit, garam, pengembang.',
    allergens: ['Gluten'],
    source: 'OPEN_FOOD_FACTS',
    verification: 'VERIFIED',
    completeness: 'INCOMPLETE',
    missingFields: ['sodium', 'fiber'],
    fetchedAt: daysAgoIso(3),
    isStale: true,
  },
  {
    id: 'p-biskuit-cokelat',
    name: 'Biskuit Gandum Cokelat',
    brand: 'Lumbung',
    basis: 'MASS',
    serving: { quantity: 28, unit: 'g', sourceText: 'per sajian' },
    nutrientsPer100: facts({ energy: 470, protein: 7.2, carbohydrate: 66, sugar: 21, fat: 19, sodium: 310, transFat: 0, fiber: 4.1 }),
    displayNutrients: ['energy', 'protein', 'sugar', 'fat', 'sodium'],
    ingredientsText: 'Tepung gandum utuh, gula, bubuk kakao, minyak nabati, garam.',
    source: 'OPEN_FOOD_FACTS',
    verification: 'VERIFIED',
    completeness: 'COMPLETE',
    missingFields: [],
    fetchedAt: daysAgoIso(2),
  },
  {
    id: 'p-crackers-wijen',
    name: 'Crackers Gandum Wijen',
    brand: 'Renyah Jaya',
    basis: 'MASS',
    serving: { quantity: 25, unit: 'g', sourceText: 'per sajian' },
    nutrientsPer100: facts({ energy: 430, protein: 9.4, carbohydrate: 64, sugar: 6.2, fat: 14, sodium: 540, transFat: 0, fiber: 5 }),
    displayNutrients: ['energy', 'protein', 'sugar', 'fat', 'sodium'],
    ingredientsText: 'Tepung gandum, wijen, minyak nabati, garam, ragi.',
    source: 'OPEN_FOOD_FACTS',
    verification: 'VERIFIED',
    completeness: 'COMPLETE',
    missingFields: [],
    fetchedAt: daysAgoIso(1),
  },
  {
    id: 'p-teh-manis',
    name: 'Teh Melati Manis',
    brand: 'Kebun Tiga',
    basis: 'VOLUME',
    serving: { quantity: 350, unit: 'ml', sourceText: 'per botol' },
    nutrientsPer100: facts({ energy: 28, protein: 0, carbohydrate: 7, sugar: 7, fat: 0, sodium: 5, transFat: 0, fiber: 0 }),
    displayNutrients: ['energy', 'sugar', 'sodium'],
    ingredientsText: 'Air, gula, daun teh melati.',
    source: 'OPEN_FOOD_FACTS',
    verification: 'VERIFIED',
    completeness: 'COMPLETE',
    missingFields: [],
    fetchedAt: daysAgoIso(4),
  },
  {
    id: 'p-teh-tanpa-gula',
    name: 'Teh Melati Tanpa Gula',
    brand: 'Kebun Tiga',
    basis: 'VOLUME',
    serving: { quantity: 350, unit: 'ml', sourceText: 'per botol' },
    nutrientsPer100: facts({ energy: 1, protein: 0, carbohydrate: 0, sugar: 0, fat: 0, sodium: 5, transFat: 0, fiber: 0 }),
    displayNutrients: ['energy', 'sugar', 'sodium'],
    ingredientsText: 'Air, daun teh melati.',
    source: 'OPEN_FOOD_FACTS',
    verification: 'VERIFIED',
    completeness: 'COMPLETE',
    missingFields: [],
    fetchedAt: daysAgoIso(4),
  },
  {
    id: 'p-susu-full',
    name: 'Susu UHT Full Cream',
    brand: 'Sapi Rimba',
    basis: 'VOLUME',
    serving: { quantity: 250, unit: 'ml', sourceText: 'kemasan 250 ml' },
    nutrientsPer100: facts({ energy: 66, protein: 3.1, carbohydrate: 4.8, sugar: 4.6, fat: 3.6, sodium: 40, transFat: 0, fiber: 0 }),
    displayNutrients: ['energy', 'protein', 'sugar', 'fat', 'sodium'],
    source: 'OPEN_FOOD_FACTS',
    verification: 'VERIFIED',
    completeness: 'COMPLETE',
    missingFields: [],
    fetchedAt: daysAgoIso(6),
  },
  {
    id: 'p-oat-instan',
    name: 'Oat Gulung Instan',
    brand: 'Ladang Pagi',
    basis: 'MASS',
    serving: { quantity: 40, unit: 'g', sourceText: 'per sajian' },
    nutrientsPer100: facts({ energy: 375, protein: 13, carbohydrate: 60, sugar: 1, fat: 7, sodium: 5, transFat: 0, fiber: 10 }),
    displayNutrients: ['energy', 'protein', 'sugar', 'fat', 'sodium'],
    source: 'OPEN_FOOD_FACTS',
    verification: 'VERIFIED',
    completeness: 'COMPLETE',
    missingFields: [],
    fetchedAt: daysAgoIso(5),
  },
  {
    id: 'p-nasi-merah',
    name: 'Nasi Merah Instan',
    brand: 'Sawah Kita',
    basis: 'MASS',
    nutrientsPer100: facts({ energy: 150, protein: 3, carbohydrate: 32, sugar: 0.4, fat: 1, sodium: 10, transFat: 0, fiber: 2 }),
    displayNutrients: ['energy', 'protein', 'carbohydrate', 'sugar', 'sodium'],
    source: 'OPEN_FOOD_FACTS',
    verification: 'VERIFIED',
    completeness: 'COMPLETE',
    missingFields: [],
    fetchedAt: daysAgoIso(5),
  },
  {
    id: 'p-ayam-panggang',
    name: 'Dada Ayam Panggang',
    brand: 'Dapur Siap',
    basis: 'MASS',
    nutrientsPer100: facts({ energy: 165, protein: 31, carbohydrate: 0, sugar: 0, fat: 3.6, sodium: 380, transFat: 0, fiber: 0 }),
    displayNutrients: ['energy', 'protein', 'fat', 'sodium'],
    source: 'OPEN_FOOD_FACTS',
    verification: 'VERIFIED',
    completeness: 'COMPLETE',
    missingFields: [],
    fetchedAt: daysAgoIso(5),
  },
  {
    id: 'p-salad',
    name: 'Salad Sayur Kemasan',
    brand: 'Kebun Segar',
    basis: 'MASS',
    nutrientsPer100: facts({ energy: 25, protein: 1.5, carbohydrate: 4, sugar: 2, fat: 0.3, sodium: 30, transFat: 0, fiber: 2.5 }),
    displayNutrients: ['energy', 'protein', 'sugar', 'sodium'],
    source: 'OPEN_FOOD_FACTS',
    verification: 'VERIFIED',
    completeness: 'COMPLETE',
    missingFields: [],
    fetchedAt: daysAgoIso(5),
  },
  {
    id: 'u-biskuit-oat',
    name: 'Biskuit Gandum Oat',
    brand: 'Dapur Ibu',
    basis: 'MASS',
    serving: { quantity: 40, unit: 'g' },
    nutrientsPer100: facts({ energy: 468, protein: 7, sugar: null, sodium: 380, fat: 20 }),
    displayNutrients: ['energy', 'protein', 'sugar', 'fat', 'sodium'],
    source: 'USER_ENTERED',
    verification: 'UNVERIFIED',
    completeness: 'INCOMPLETE',
    missingFields: ['sugar'],
    createdAt: daysAgoIso(12),
  },
  {
    id: 'u-keripik-balado',
    name: 'Keripik Singkong Balado',
    brand: 'Warung Bu Tini',
    barcode: '8991234567000',
    basis: 'MASS',
    serving: { quantity: 50, unit: 'g', sourceText: 'per bungkus' },
    nutrientsPer100: facts({ energy: 520, fat: 28, protein: 0, sugar: null, sodium: null }),
    displayNutrients: ['energy', 'fat', 'protein', 'sugar', 'sodium'],
    source: 'USER_ENTERED',
    verification: 'UNVERIFIED',
    completeness: 'INCOMPLETE',
    missingFields: ['sugar', 'sodium'],
    createdAt: daysAgoIso(2),
  },
  {
    id: 'u-pisang',
    name: 'Pisang (dimasukkan manual)',
    basis: 'MASS',
    nutrientsPer100: facts({ energy: 89, protein: 1.1, carbohydrate: 23, sugar: 12, fat: 0.3, sodium: null }),
    displayNutrients: ['energy', 'protein', 'sugar', 'sodium'],
    source: 'USER_ENTERED',
    verification: 'UNVERIFIED',
    completeness: 'INCOMPLETE',
    missingFields: ['sodium'],
    createdAt: daysAgoIso(20),
  },
];

export const demoPreferences: Preference[] = [
  { id: 'pref-sugar', type: 'SUGAR_MAX_PER_PORTION', label: 'Batas gula per porsi', value: 12, unit: 'g' },
  { id: 'pref-sodium', type: 'SODIUM_MAX_PER_PORTION', label: 'Batas natrium per porsi', value: 800, unit: 'mg' },
  { id: 'pref-avoid', type: 'AVOID_INGREDIENTS', label: 'Bahan yang dihindari', value: null, ingredients: ['Kacang tanah', 'Udang'] },
];

/** Plan contoh dari mitra Ambatufit (hanya baca). */
export const demoNutritionPlan: NutritionPlan = {
  sourceName: 'Ambatufit',
  receivedAt: daysAgoIso(11),
  checkedAt: new Date().toISOString(),
  targets: [
    { key: 'energy', label: 'Energi harian', valueLabel: '2.000 kkal' },
    { key: 'protein', label: 'Protein harian', valueLabel: '60 g' },
    { key: 'sodium', label: 'Natrium per porsi', valueLabel: '≤ 600 mg' },
    { key: 'sugar', label: 'Gula harian', valueLabel: '≤ 50 g' },
  ],
};

/** Aturan plan yang dipakai service contoh untuk penilaian & target ringkasan. */
export const demoPlanRules = {
  sodiumMaxPerPortion: 600,
  dailyTargets: { energy: 2000, protein: 60, sugar: 50 } as Record<string, number>,
};

const item = (productId: string, quantity: number) => {
  const p = demoProducts.find((x) => x.id === productId)!;
  return { productId, productName: p.name, quantity, unit: p.basis === 'MASS' ? ('g' as const) : ('ml' as const), source: p.source };
};

export const demoFavorites: FavoriteMeal[] = [
  {
    id: 'fav-oat',
    name: 'Oat pisang & susu',
    slotHint: 'SARAPAN',
    items: [item('p-oat-instan', 40), item('p-susu-full', 200), item('u-pisang', 100)],
    outcome: 'COCOK',
    completeness: 'INCOMPLETE',
    totals: {},
  },
  {
    id: 'fav-nasi',
    name: 'Nasi merah, ayam panggang, salad',
    slotHint: 'MAKAN_SIANG',
    items: [item('p-nasi-merah', 150), item('p-ayam-panggang', 100), item('p-salad', 80)],
    outcome: 'COCOK',
    completeness: 'COMPLETE',
    totals: {},
  },
  {
    id: 'fav-roti',
    name: 'Roti gandum selai kacang',
    slotHint: 'CAMILAN',
    items: [item('p-biskuit-cokelat', 50), item('p-susu-cokelat', 100)],
    outcome: 'KURANG_COCOK',
    completeness: 'COMPLETE',
    totals: {},
  },
  {
    id: 'fav-sup',
    name: 'Sup sayur & tahu',
    slotHint: 'MAKAN_MALAM',
    items: [item('p-salad', 150), item('u-pisang', 50)],
    outcome: 'BELUM_DAPAT_DINILAI',
    completeness: 'INCOMPLETE',
    totals: {},
  },
];

/** Total per hidangan: bila satu item tidak punya nilai, total = null (bukan jumlah parsial). */
export function computeTotals(items: FavoriteMeal['items']): Partial<NutrientFacts> {
  const out: Partial<NutrientFacts> = {};
  (['energy', 'protein', 'carbohydrate', 'fat', 'sugar', 'sodium'] as const).forEach((k) => {
    let sum = 0;
    for (const it of items) {
      const p = demoProducts.find((x) => x.id === it.productId);
      const v = p?.nutrientsPer100[k];
      if (v === null || v === undefined) {
        out[k] = null;
        return;
      }
      sum += (v * it.quantity) / 100;
    }
    out[k] = sum;
  });
  return out;
}
demoFavorites.forEach((f) => (f.totals = computeTotals(f.items)));

export function snapshotForItems(items: FavoriteMeal['items']): NutrientFacts {
  const t = computeTotals(items);
  return { ...emptyFacts(), ...t } as NutrientFacts;
}

function at(dayOffset: number, h: number, m: number) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export function buildDemoPlans(): MealPlanEntry[] {
  const today = todayKey();
  const fav = (id: string) => demoFavorites.find((f) => f.id === id)!;
  const entry = (
    id: string,
    date: string,
    slot: MealPlanEntry['slot'],
    favId: string,
    status: MealPlanEntry['status'],
    consumedAt?: string,
  ): MealPlanEntry => ({
    id,
    date,
    slot,
    title: fav(favId).name,
    favoriteId: favId,
    items: fav(favId).items,
    status,
    consumedAt,
    outcome: fav(favId).outcome,
    syncStatus: 'SYNCED',
    version: 1,
  });
  return [
    entry('plan-1', today, 'SARAPAN', 'fav-oat', 'CONSUMED', at(0, 7, 20)),
    entry('plan-2', today, 'MAKAN_SIANG', 'fav-nasi', 'PLANNED'),
    entry('plan-3', addDays(today, -1), 'SARAPAN', 'fav-oat', 'CONSUMED', at(-1, 7, 0)),
    entry('plan-4', addDays(today, -1), 'MAKAN_SIANG', 'fav-nasi', 'CONSUMED', at(-1, 12, 10)),
    entry('plan-5', addDays(today, 1), 'SARAPAN', 'fav-oat', 'PLANNED'),
    entry('plan-6', addDays(today, 1), 'MAKAN_SIANG', 'fav-nasi', 'PLANNED'),
  ];
}

export function buildDemoRecords(): ConsumptionRecord[] {
  const susu = demoProducts[0];
  const biskuit = demoProducts[1];
  const fav = demoFavorites[0];
  return [
    {
      id: 'rec-1',
      consumedAt: at(0, 7, 20),
      title: fav.name,
      favoriteId: fav.id,
      planEntryId: 'plan-1',
      source: 'FAVORITE',
      quantity: 1,
      unit: 'g',
      itemsCount: fav.items.length,
      snapshot: snapshotForItems(fav.items),
      syncStatus: 'SYNCED',
      version: 1,
    },
    {
      id: 'rec-2',
      consumedAt: at(-1, 19, 10),
      title: biskuit.name,
      productId: biskuit.id,
      source: 'SEARCH',
      quantity: 60,
      unit: 'g',
      itemsCount: 1,
      snapshot: scaleFacts(biskuit.nutrientsPer100, 60),
      syncStatus: 'SYNCED',
      version: 1,
    },
    {
      id: 'rec-3',
      consumedAt: at(-1, 15, 0),
      title: susu.name,
      productId: susu.id,
      source: 'SCAN',
      quantity: 200,
      unit: 'ml',
      itemsCount: 1,
      snapshot: scaleFacts(susu.nutrientsPer100, 200),
      syncStatus: 'SYNCED',
      version: 1,
    },
  ];
}

export const demoRestaurants = [
  { id: 'r-1', name: 'Contoh: Warung Sehat Dago', distanceLabel: '0,6 km', address: 'Jl. contoh no. 12', matchedMenu: 'salad ayam panggang' },
  { id: 'r-2', name: 'Contoh: Dapur Nasi Merah', distanceLabel: '1,1 km', address: 'Jl. contoh no. 40', matchedMenu: 'nasi merah lauk ayam' },
  { id: 'r-3', name: 'Contoh: Kedai Salad Pagi', distanceLabel: '1,8 km', address: 'Jl. contoh no. 7', matchedMenu: 'salad sayur' },
];

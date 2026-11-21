import { emptyFacts, scaleFacts } from '../../shared/domain/nutrients';
import type { MealItem, NutrientFacts, NutrientKey, Product } from '../../shared/domain/types';
import { catalogService } from '../../services/catalog';

/**
 * Salinan gizi untuk Catatan Konsumsi (BR-09). Dihitung dari basis kanonik per-100 × kuantitas.
 * Untuk hidangan multi-item: bila satu item tidak punya nilai suatu nutrien, nilai tsb = null
 * (tidak menjumlah parsial sebagai angka pasti). Aturan final mengikuti backend.
 */
export function sumFacts(parts: NutrientFacts[]): NutrientFacts {
  const out = emptyFacts();
  (Object.keys(out) as NutrientKey[]).forEach((k) => {
    let sum = 0;
    for (const p of parts) {
      const v = p[k];
      if (v === null) {
        out[k] = null;
        return;
      }
      sum += v;
    }
    out[k] = parts.length ? sum : null;
  });
  return out;
}

export async function snapshotForItems(
  items: MealItem[],
  multiplier: number,
  cached: (id: string) => Product | undefined,
): Promise<NutrientFacts> {
  const parts: NutrientFacts[] = [];
  for (const it of items) {
    let product: Product | undefined;
    try {
      product = await catalogService.getProduct(it.productId);
    } catch {
      product = cached(it.productId);
    }
    parts.push(product ? scaleFacts(product.nutrientsPer100, it.quantity * multiplier) : emptyFacts());
  }
  return sumFacts(parts);
}

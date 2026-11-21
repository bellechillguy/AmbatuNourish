import { basisUnit, emptyFacts, scaleFacts } from '../../shared/domain/nutrients';
import type { MealItem, NutrientFacts, NutrientKey, Product } from '../../shared/domain/types';
import { catalogService } from '../../services/catalog';
import { isOnline } from '../../services/network';

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
  const parts = await Promise.all(items.map(async (item) => {
    let product = cached(item.productId);
    if (isOnline()) {
      try {
        product = await catalogService.getProduct(item.productId);
      } catch {
        // Gunakan cache lokal bila sumber sedang tidak tersedia.
      }
    }
    return product && product.basisKnown !== false && basisUnit(product.basis) === item.unit
      ? scaleFacts(product.nutrientsPer100, item.quantity * multiplier)
      : emptyFacts();
  }));
  return sumFacts(parts);
}

/**
 * Food Catalog (supporting). Mobile → backend AmbatuNourish; backend → Open Food Facts lewat ACL.
 * Mobile TIDAK memanggil Open Food Facts langsung (requirements §7.4.1, §8.5).
 */
import { config } from '../shared/api/config';
import { AppError } from '../shared/api/errors';
import { pbString, request, type ListResponse } from '../shared/api/http';
import { emptyFacts } from '../shared/domain/nutrients';
import type { ManualProductInput, NutrientKey, Product, ProductSummary } from '../shared/domain/types';
import { DEMO_BARCODE_NOT_FOUND, demoProducts } from './fixtures';
import { delay, ensureOnline } from './network';

export type SourceFilter = 'ALL' | 'OPEN_FOOD_FACTS' | 'USER_ENTERED';

export interface CatalogService {
  lookupBarcode(barcode: string): Promise<Product | null>;
  search(query: string, filter: SourceFilter): Promise<ProductSummary[]>;
  getProduct(id: string): Promise<Product>;
  listMyProducts(): Promise<ProductSummary[]>;
  createManualProduct(input: ManualProductInput): Promise<Product>;
  updateManualProduct(id: string, input: ManualProductInput): Promise<Product>;
  deleteManualProduct(id: string): Promise<void>;
  refresh(id: string): Promise<Product>;
}

export function toSummary(p: Product): ProductSummary {
  const size = p.serving ? `${p.serving.quantity} ${p.serving.unit}` : undefined;
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    sizeLabel: size,
    source: p.source,
    completeness: p.completeness,
    verification: p.verification,
  };
}

const DISPLAY_DEFAULT: NutrientKey[] = ['energy', 'protein', 'sugar', 'fat', 'sodium'];

function buildManual(id: string, input: ManualProductInput, createdAt: string): Product {
  const per100 = { ...emptyFacts(), ...input.nutrientsPer100 };
  const keys: NutrientKey[] = ['energy', 'fat', 'protein', 'sugar', 'sodium'];
  const missing = keys.filter((k) => per100[k] === null);
  return {
    id,
    name: input.name,
    brand: input.brand,
    barcode: input.barcode,
    basis: input.basis,
    serving: input.serving,
    nutrientsPer100: per100,
    displayNutrients: keys,
    source: 'USER_ENTERED',
    verification: 'UNVERIFIED',
    completeness: missing.length === 0 ? 'COMPLETE' : missing.length === keys.length ? 'INSUFFICIENT' : 'INCOMPLETE',
    missingFields: missing,
    createdAt,
  };
}

/* ---------- HTTP ---------- */
/**
 * Baca produk memakai endpoint gateway yang SUDAH ADA (/api/products, /api/products/:id).
 * Bentuk DTO kanonik (nutrientsPer100, completeness, provenance) masih PENDING di kontrak
 * Food Catalog — mapper di bawah mengharapkan backend mengirim field tsb apa adanya.
 * Produk manual pribadi belum punya endpoint → CONTRACT_PENDING.
 */
class HttpCatalogService implements CatalogService {
  async lookupBarcode(barcode: string): Promise<Product | null> {
    const res = await request<ListResponse<Product>>('/products', { query: { filter: `barcode=${pbString(barcode)}`, perPage: 1 } });
    return res.items[0] ? normalize(res.items[0]) : null;
  }

  async search(query: string, filter: SourceFilter): Promise<ProductSummary[]> {
    const clauses = [`(name~${pbString(query)} || brand~${pbString(query)} || barcode=${pbString(query)})`];
    if (filter !== 'ALL') clauses.push(`source=${pbString(filter)}`);
    const res = await request<ListResponse<Product>>('/products', { query: { filter: clauses.join(' && '), perPage: 30 } });
    return res.items.map((p) => toSummary(normalize(p)));
  }

  async getProduct(id: string): Promise<Product> {
    return normalize(await request<Product>(`/products/${encodeURIComponent(id)}`));
  }

  async listMyProducts(): Promise<ProductSummary[]> {
    throw new AppError('CONTRACT_PENDING');
  }

  async createManualProduct(): Promise<Product> {
    throw new AppError('CONTRACT_PENDING');
  }

  async updateManualProduct(): Promise<Product> {
    throw new AppError('CONTRACT_PENDING');
  }

  async deleteManualProduct(): Promise<void> {
    throw new AppError('CONTRACT_PENDING');
  }

  async refresh(id: string): Promise<Product> {
    return this.getProduct(id);
  }
}

/** Jaga invariant: nutrien yang tidak dikirim backend = null (unknown), bukan 0. */
function normalize(p: Product): Product {
  return {
    ...p,
    nutrientsPer100: { ...emptyFacts(), ...(p.nutrientsPer100 ?? {}) },
    displayNutrients: p.displayNutrients?.length ? p.displayNutrients : DISPLAY_DEFAULT,
    missingFields: p.missingFields ?? [],
  };
}

/* ---------- Mock (DEMO) ---------- */

class MockCatalogService implements CatalogService {
  private products: Product[] = demoProducts.map((p) => ({ ...p }));

  async lookupBarcode(barcode: string): Promise<Product | null> {
    await delay(900);
    ensureOnline();
    if (barcode === DEMO_BARCODE_NOT_FOUND) return null;
    return this.products.find((p) => p.barcode === barcode) ?? null;
  }

  async search(query: string, filter: SourceFilter): Promise<ProductSummary[]> {
    await delay(300);
    ensureOnline();
    const q = query.trim().toLowerCase();
    return this.products
      .filter((p) => filter === 'ALL' || p.source === filter)
      .filter((p) => {
        if (!q) return true;
        if (p.barcode === q) return true;
        const hay = `${p.name} ${p.brand ?? ''}`.toLowerCase();
        return q.split(/\s+/).every((w) => hay.includes(w));
      })
      .map(toSummary);
  }

  async getProduct(id: string): Promise<Product> {
    await delay(250);
    const p = this.products.find((x) => x.id === id);
    if (!p) throw new AppError('NOT_FOUND');
    return { ...p };
  }

  async listMyProducts(): Promise<ProductSummary[]> {
    await delay(200);
    return this.products.filter((p) => p.source === 'USER_ENTERED').map(toSummary);
  }

  async createManualProduct(input: ManualProductInput): Promise<Product> {
    await delay();
    ensureOnline(); // PROPOSED: simpan produk manual butuh koneksi
    const p = buildManual(`u-${Date.now()}`, input, new Date().toISOString());
    this.products.unshift(p);
    return p;
  }

  async updateManualProduct(id: string, input: ManualProductInput): Promise<Product> {
    await delay();
    ensureOnline();
    const idx = this.products.findIndex((p) => p.id === id && p.source === 'USER_ENTERED');
    if (idx < 0) throw new AppError('NOT_FOUND');
    const p = buildManual(id, input, this.products[idx].createdAt ?? new Date().toISOString());
    this.products[idx] = p;
    return p;
  }

  async deleteManualProduct(id: string): Promise<void> {
    await delay();
    ensureOnline();
    this.products = this.products.filter((p) => !(p.id === id && p.source === 'USER_ENTERED'));
  }

  async refresh(id: string): Promise<Product> {
    await delay(600);
    ensureOnline();
    const idx = this.products.findIndex((p) => p.id === id);
    if (idx < 0) throw new AppError('NOT_FOUND');
    this.products[idx] = { ...this.products[idx], isStale: false, fetchedAt: new Date().toISOString() };
    return { ...this.products[idx] };
  }
}

export const catalogService: CatalogService = config.useMock ? new MockCatalogService() : new HttpCatalogService();

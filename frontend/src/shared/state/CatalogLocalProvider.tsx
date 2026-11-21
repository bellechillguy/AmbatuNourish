import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Product, ProductSummary } from '../domain/types';
import { toSummary } from '../../services/catalog';
import { useSession } from './SessionProvider';
import { readJson, userKey, writeJson } from './storage';

/** Maksimum produk dalam perbandingan (PROPOSED §5.3.4). */
export const COMPARE_LIMIT = 3;

interface CatalogLocalValue {
  /** Produk terakhir dilihat (D1) — juga cache baca offline (D5/D6). */
  recent: ProductSummary[];
  rememberProduct(p: Product): void;
  cachedProduct(id: string): Product | undefined;
  searchCache(query: string): ProductSummary[];
  /** Baki perbandingan (G1). */
  compareIds: string[];
  /** Mengembalikan 'LIMIT' bila sudah 3 produk (→ G2). */
  addToCompare(id: string): 'ADDED' | 'EXISTS' | 'LIMIT';
  removeFromCompare(id: string): void;
  replaceInCompare(oldId: string, newId: string): void;
  setCompare(ids: string[]): void;
}

const Ctx = createContext<CatalogLocalValue | null>(null);

interface Stored {
  cache: Record<string, Product>;
  recentIds: string[];
  compareIds: string[];
}

export function CatalogLocalProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [data, setData] = useState<Stored>({ cache: {}, recentIds: [], compareIds: [] });
  const key = user ? userKey(user.id, 'catalog-local') : null;

  useEffect(() => {
    if (!key) return;
    void readJson<Stored>(key, { cache: {}, recentIds: [], compareIds: [] }).then(setData);
  }, [key]);

  const update = useCallback(
    (fn: (d: Stored) => Stored) => {
      setData((d) => {
        const next = fn(d);
        if (key) void writeJson(key, next);
        return next;
      });
    },
    [key],
  );

  const value = useMemo<CatalogLocalValue>(
    () => ({
      recent: data.recentIds.map((id) => data.cache[id]).filter(Boolean).map(toSummary),
      rememberProduct(p) {
        update((d) => ({
          ...d,
          cache: { ...d.cache, [p.id]: { ...p, isStale: false } },
          recentIds: [p.id, ...d.recentIds.filter((x) => x !== p.id)].slice(0, 10),
        }));
      },
      cachedProduct(id) {
        const p = data.cache[id];
        // Data dari cache perangkat selalu ditandai mungkin belum terbaru.
        return p ? { ...p, isStale: true } : undefined;
      },
      searchCache(query) {
        const q = query.trim().toLowerCase();
        return Object.values(data.cache)
          .filter((p) => !q || `${p.name} ${p.brand ?? ''}`.toLowerCase().includes(q) || p.barcode === q)
          .map(toSummary);
      },
      compareIds: data.compareIds,
      addToCompare(id) {
        if (data.compareIds.includes(id)) return 'EXISTS';
        if (data.compareIds.length >= COMPARE_LIMIT) return 'LIMIT';
        update((d) => ({ ...d, compareIds: [...d.compareIds, id] }));
        return 'ADDED';
      },
      removeFromCompare(id) {
        update((d) => ({ ...d, compareIds: d.compareIds.filter((x) => x !== id) }));
      },
      replaceInCompare(oldId, newId) {
        update((d) => ({ ...d, compareIds: d.compareIds.map((x) => (x === oldId ? newId : x)) }));
      },
      setCompare(ids) {
        update((d) => ({ ...d, compareIds: ids.slice(0, COMPARE_LIMIT) }));
      },
    }),
    [data, update],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalogLocal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCatalogLocal harus di dalam CatalogLocalProvider');
  return ctx;
}

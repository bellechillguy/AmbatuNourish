/**
 * J3: Tambah ke slot (sheet). Sumber = Favorit atau cari produk. Bekerja offline (disimpan lokal →
 * "Tersimpan di perangkat"). Chip penilaian hanya muncul bila service mengembalikannya.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '../../shared/api/errors';
import { AppText, BottomSheet, Button, FilterChip, RadioRow, StatusChip, outcomeChip, useToast } from '../../shared/components';
import { SLOT_LABEL, SLOT_ORDER } from '../../shared/domain/nutrients';
import type { FavoriteMeal, MealItem, MealSlot, ProductSummary } from '../../shared/domain/types';
import { useCatalogLocal } from '../../shared/state/CatalogLocalProvider';
import { useSession } from '../../shared/state/SessionProvider';
import { newId } from '../../shared/sync/queue';
import { useOfflineData } from '../../shared/sync/OfflineDataProvider';
import { spacing } from '../../shared/theme';
import { formatShortDay } from '../../shared/utils/date';
import { catalogService } from '../../services/catalog';
import { mealPlanningService } from '../../services/mealPlanning';
import { SearchField } from '../food-catalog/components';

export interface PrefillProduct {
  id: string;
  name: string;
  quantity: number;
  unit: 'g' | 'ml';
  source: 'OPEN_FOOD_FACTS' | 'USER_ENTERED';
}

export function AddToSlotSheet({
  visible,
  date,
  slot: initialSlot,
  prefill,
  favoriteId,
  replaceId,
  onClose,
}: {
  visible: boolean;
  date: string;
  slot: MealSlot;
  prefill?: PrefillProduct;
  favoriteId?: string;
  /** Mode ubah (J4 → edit): perbarui entri yang ada, bukan membuat baru. */
  replaceId?: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const { savePlan, plans } = useOfflineData();
  const { searchCache, cachedProduct, rememberProduct } = useCatalogLocal();
  const { user } = useSession();
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [mode, setMode] = useState<'favorites' | 'search'>(prefill ? 'search' : 'favorites');
  const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(prefill ? `p:${prefill.id}` : null);

  useEffect(() => {
    if (!visible) return;
    setSlot(initialSlot);
    setMode(prefill ? 'search' : 'favorites');
    setSelected(prefill ? `p:${prefill.id}` : favoriteId ? `f:${favoriteId}` : null);
    let active = true;
    void mealPlanningService.listFavorites(user?.id).then((f) => {
      if (!active) return;
      setFavorites(f);
      if (!prefill && f[0]) setSelected((s) => s ?? `f:${f[0].id}`);
    }).catch(() => { if (active) setFavorites([]); });
    return () => { active = false; };
  }, [visible, initialSlot, prefill, favoriteId, user?.id]);

  useEffect(() => {
    if (mode !== 'search' || !visible) return;
    const t = setTimeout(() => {
      catalogService
        .search(query, 'ALL')
        .then(setResults)
        // Offline: pilih dari produk tersimpan di perangkat.
        .catch(() => setResults(searchCache(query)));
    }, 300);
    return () => clearTimeout(t);
  }, [query, mode, visible, searchCache]);

  const add = async () => {
    if (!selected) return;
    let title = '';
    let items: MealItem[] = [];
    let favoriteId: string | undefined;
    let outcome: FavoriteMeal['outcome'];
    if (selected.startsWith('f:')) {
      const fav = favorites.find((f) => `f:${f.id}` === selected);
      if (!fav) return;
      title = fav.name;
      items = fav.items;
      favoriteId = fav.id;
      outcome = fav.outcome;
    } else {
      const id = selected.slice(2);
      const fromPrefill = prefill && prefill.id === id ? prefill : undefined;
      const summary = results.find((r) => r.id === id);
      let quantity = fromPrefill?.quantity ?? 100;
      let unit: 'g' | 'ml' = fromPrefill?.unit ?? 'g';
      if (!fromPrefill) {
        const product = await catalogService.getProduct(id).catch((error) => {
          const cached = cachedProduct(id);
          if (!cached) toast({ message: errorMessage(error) });
          return cached;
        });
        if (!product) return;
        if (product.basisKnown === false) {
          toast({ message: 'Satuan produk belum tersedia.' });
          return;
        }
        rememberProduct(product);
        unit = product.basis === 'MASS' ? 'g' : 'ml';
        quantity = product.serving && product.serving.unit === unit ? product.serving.quantity : 100;
      }
      title = fromPrefill?.name ?? summary?.name ?? 'Produk';
      items = [{ productId: id, productName: title, quantity, unit, source: fromPrefill?.source ?? summary?.source ?? 'OPEN_FOOD_FACTS' }];
    }
    const existing = replaceId ? plans.find((p) => p.id === replaceId) : undefined;
    const undo = savePlan({
      id: existing?.id ?? newId('plan'),
      date,
      slot,
      title,
      favoriteId,
      items,
      status: existing?.status ?? 'PLANNED',
      consumedAt: existing?.consumedAt,
      outcome,
      syncStatus: 'PENDING',
      version: existing?.version ?? 0,
    });
    onClose();
    toast({ message: existing ? 'Rencana diperbarui' : 'Ditambahkan ke rencana', actionLabel: 'Urungkan', onAction: undo });
  };

  const productOptions: ProductSummary[] = [
    ...(prefill && !results.some((r) => r.id === prefill.id)
      ? [{ id: prefill.id, name: prefill.name, source: prefill.source, completeness: 'COMPLETE' as const, verification: 'VERIFIED' as const }]
      : []),
    ...results,
  ];

  return (
    <BottomSheet visible={visible} title={`${SLOT_LABEL[slot]}, ${formatShortDay(date)}`} onClose={onClose}>
      <View style={styles.chips} accessibilityLabel="Slot makan">
        {SLOT_ORDER.map((s) => (
          <FilterChip key={s} label={SLOT_LABEL[s]} selected={s === slot} onPress={() => setSlot(s)} />
        ))}
      </View>
      <View style={styles.chips}>
        <FilterChip label="Favorit" selected={mode === 'favorites'} onPress={() => setMode('favorites')} />
        <FilterChip label="Cari produk" selected={mode === 'search'} onPress={() => setMode('search')} />
      </View>

      {mode === 'favorites' ? (
        favorites.length === 0 ? (
          <AppText variant="subheadline" tone="secondary">
            Belum ada favorit. Pilih “Cari produk” atau simpan favorit dari halaman produk.
          </AppText>
        ) : (
          <View>
            {favorites.map((f) => (
              <RadioRow
                key={f.id}
                label={f.name}
                subtitle={`${f.items.length} item`}
                selected={selected === `f:${f.id}`}
                onPress={() => setSelected(`f:${f.id}`)}
              >
                {f.outcome ? <StatusChip status={outcomeChip[f.outcome]} /> : null}
              </RadioRow>
            ))}
          </View>
        )
      ) : (
        <View style={{ gap: spacing.s }}>
          <SearchField value={query} onChangeText={setQuery} placeholder="Cari produk" />
          {productOptions.map((p) => (
            <RadioRow
              key={p.id}
              label={p.name}
              subtitle={p.brand}
              selected={selected === `p:${p.id}`}
              onPress={() => setSelected(`p:${p.id}`)}
            />
          ))}
        </View>
      )}
      <Button label={replaceId ? 'Simpan perubahan' : 'Tambahkan ke rencana'} onPress={add} disabled={!selected} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
});

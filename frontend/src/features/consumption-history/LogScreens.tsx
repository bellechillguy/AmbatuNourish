/**
 * 11. Catatan Konsumsi — K0 pilih sumber, K1 catat (porsi + waktu), K2 waktu tidak valid,
 * K4 ubah catatan, K5 konfirmasi hapus. (K3 = SummaryHomeScreen › Riwayat.)
 * Waktu default = sekarang; boleh mundur; masa depan ditolak (PROPOSED).
 * Catatan menyimpan snapshot gizi; perubahan katalog berikutnya tidak mengubahnya (BR-09).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useRootNav, type LogFormParams } from '../../app/navigation/types';
import { AppError, errorMessage } from '../../shared/api/errors';
import {
  ActionBar,
  AppText,
  Banner,
  Button,
  Dialog,
  FilterChip,
  Icon,
  ListRow,
  NutrientRow,
  Screen,
  SectionHeader,
  Skeleton,
  StatusChip,
  TextField,
  Tile,
  TopAppBar,
  syncChip,
  useToast,
} from '../../shared/components';
import { SLOT_LABEL, basisUnit, scaleFacts } from '../../shared/domain/nutrients';
import type { ConsumptionRecord, FavoriteMeal, NutrientFacts, NutrientKey, Product, ProductSummary } from '../../shared/domain/types';
import { useCatalogLocal } from '../../shared/state/CatalogLocalProvider';
import { useSession } from '../../shared/state/SessionProvider';
import { useAsync } from '../../shared/state/useAsync';
import { newId } from '../../shared/sync/queue';
import { useOfflineData } from '../../shared/sync/OfflineDataProvider';
import { colors, spacing } from '../../shared/theme';
import { formatShortDay, formatTime, fromDateKey, relativeDayLabel, toDateKey, todayKey } from '../../shared/utils/date';
import { formatNumber, parseDecimal, toInputText } from '../../shared/utils/format';
import { catalogService } from '../../services/catalog';
import { mealPlanningService } from '../../services/mealPlanning';
import { SearchField } from '../food-catalog/components';
import { portionPresets } from '../nutritional-assessment/PortionSheet';
import { DateTimePickerField } from './DateTimePickerField';
import { snapshotForItems } from './snapshot';

/* ------------------------------ K0 ------------------------------ */

export function LogSourceScreen({ route }: { route: { params?: { date?: string } } }) {
  const nav = useRootNav();
  const date = route.params?.date;
  const { plans, records } = useOfflineData();
  const [query, setQuery] = useState('');
  const { user } = useSession();
  const favs = useAsync(() => mealPlanningService.listFavorites(user?.id), [user?.id]);
  const search = useAsync<ProductSummary[]>(
    () => (query.trim() ? catalogService.search(query, 'ALL') : Promise.resolve([])),
    [query],
  );
  const today = todayKey();
  const planned = plans.find((p) => p.date === today && p.status === 'PLANNED');
  const lastProductRecord = [...records].sort((a, b) => b.consumedAt.localeCompare(a.consumedAt)).find((r) => r.productId);
  const q = query.trim().toLowerCase();
  const favMatches = (favs.data ?? []).filter((f) => !q || f.name.toLowerCase().includes(q));

  const toProduct = (id: string) => nav.navigate('LogForm', { source: 'SEARCH', productId: id, date });
  const toFavorite = (f: FavoriteMeal) => nav.navigate('LogForm', { source: 'FAVORITE', favoriteId: f.id, date });

  return (
    <Screen gap={spacing.m}>
      <TopAppBar leading="close" onLeading={() => nav.goBack()} title={date && date !== today ? `Catat untuk ${formatShortDay(date)}` : 'Catat makan'} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Cari produk atau favorit" />
      {q ? (
        <>
          {favMatches.map((f) => (
            <ListRow key={f.id} title={f.name} subtitle={`Favorit, ${f.items.length} item`} leading={<Tile icon="heart" tone="user" />} onPress={() => toFavorite(f)} />
          ))}
          {search.loading ? <Skeleton width="100%" height={60} /> : null}
          {search.error ? <Banner type="offline" title="Pencarian produk butuh koneksi internet" message="Favorit tetap bisa dipilih." /> : null}
          {(search.data ?? []).map((p) => (
            <ListRow
              key={p.id}
              title={p.name}
              subtitle={p.brand}
              leading={<Tile tone={p.source === 'USER_ENTERED' ? 'user' : 'neutral'} />}
              onPress={() => toProduct(p.id)}
            />
          ))}
        </>
      ) : (
        <>
          <View style={styles.row}>
            <Button label="Pindai" icon="scan" type="secondary" onPress={() => nav.navigate('CameraPermission')} style={styles.flex} />
            <Button label="Produk baru" icon="plus" type="secondary" onPress={() => nav.navigate('ManualProductForm')} style={styles.flex} />
          </View>
          {planned ? (
            <>
              <SectionHeader title="Dari rencana hari ini" variant="headline" />
              <ListRow
                title={planned.title}
                subtitle={`${SLOT_LABEL[planned.slot]}, direncanakan`}
                leading={
                  <View style={styles.iconBox}>
                    <Icon name="planned" size={24} />
                  </View>
                }
                // Item terencana tetap butuh konfirmasi (J5).
                onPress={() => nav.navigate('PlanDetail', { planId: planned.id, markConsumed: true })}
              />
            </>
          ) : null}
          {favs.data && favs.data[0] ? (
            <>
              <SectionHeader title="Favorit" variant="headline" />
              <ListRow
                title={favs.data[0].name}
                subtitle={`${favs.data[0].items.length} item`}
                leading={<Tile icon="heart" tone="user" />}
                onPress={() => toFavorite(favs.data![0])}
              />
            </>
          ) : null}
          {lastProductRecord?.productId ? (
            <>
              <SectionHeader title="Terakhir dicatat" variant="headline" />
              <ListRow
                title={lastProductRecord.title}
                subtitle={`${formatNumber(lastProductRecord.quantity)} ${lastProductRecord.unit}, ${relativeDayLabel(toDateKey(new Date(lastProductRecord.consumedAt))).toLowerCase()}`}
                leading={<Tile />}
                onPress={() => toProduct(lastProductRecord.productId!)}
              />
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

/* ------------------------------ K1 / K2 / K4 / K5 ------------------------------ */

const MULTIPLIERS = [
  { label: '½ porsi', value: 0.5 },
  { label: '1 porsi', value: 1 },
  { label: '1½ porsi', value: 1.5 },
  { label: '2 porsi', value: 2 },
];
const PREVIEW_KEYS: NutrientKey[] = ['energy', 'sugar', 'sodium'];

export function LogFormScreen({ route }: { route: { params: LogFormParams } }) {
  const nav = useRootNav();
  const toast = useToast();
  const params = route.params;
  const { records, saveRecord, deleteRecord } = useOfflineData();
  const { cachedProduct } = useCatalogLocal();
  const { user } = useSession();
  const existing = params.recordId ? records.find((r) => r.id === params.recordId) : undefined;
  const editing = !!existing;

  const [product, setProduct] = useState<Product | null>(null);
  const [favorite, setFavorite] = useState<FavoriteMeal | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qtyText, setQtyText] = useState('');
  const [multiplier, setMultiplier] = useState(1);
  const [when, setWhen] = useState<Date>(() => {
    if (existing) return new Date(existing.consumedAt);
    if (params.date && params.date !== todayKey()) {
      const d = fromDateKey(params.date);
      d.setHours(12, 0, 0, 0);
      return d;
    }
    return new Date();
  });
  const [favSnapshot, setFavSnapshot] = useState<NutrientFacts | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [qtyError, setQtyError] = useState<string | null>(null);

  // Muat sumber (produk / favorit). Mode ubah memakai snapshot tersimpan.
  useEffect(() => {
    if (existing) {
      setQtyText(toInputText(existing.quantity));
      if (existing.itemsCount > 1 || existing.source === 'FAVORITE') setMultiplier(existing.quantity);
      return;
    }
    if (params.productId) {
      catalogService
        .getProduct(params.productId)
        .catch(() => {
          const c = cachedProduct(params.productId!);
          if (c) return c;
          throw new AppError('OFFLINE');
        })
        .then((p) => {
          if (p.basisKnown === false) {
            setLoadError('Satuan gizi belum tersedia. Gunakan data pada kemasan untuk menambahkan produk sendiri.');
            return;
          }
          setProduct(p);
          const unit = basisUnit(p.basis);
          setQtyText(toInputText(params.quantity ?? (p.serving && p.serving.unit === unit ? p.serving.quantity : 100)));
        })
        .catch((e) => setLoadError(errorMessage(e)));
    } else if (params.favoriteId) {
      mealPlanningService
        .getFavorite(params.favoriteId, user?.id)
        .then(setFavorite)
        .catch((e) => setLoadError(errorMessage(e)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.productId, params.favoriteId, params.recordId, user?.id]);

  useEffect(() => {
    let active = true;
    setFavSnapshot(null);
    if (favorite) void snapshotForItems(favorite.items, multiplier, cachedProduct).then((snapshot) => {
      if (active) setFavSnapshot(snapshot);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorite, multiplier]);

  const isMeal = !!favorite || (existing ? existing.itemsCount > 1 || existing.source === 'FAVORITE' : false);
  const unit = product ? basisUnit(product.basis) : existing?.unit ?? 'g';
  const qty = parseDecimal(qtyText);

  /** Snapshot untuk disimpan / pratinjau. */
  const snapshot: NutrientFacts | null = useMemo(() => {
    if (existing) {
      if (isMeal) {
        if (multiplier === existing.quantity) return existing.snapshot;
        const ratio = existing.quantity ? multiplier / existing.quantity : 1;
        return scaleFacts(existing.snapshot, ratio * 100);
      }
      if (qty === null || Number.isNaN(qty) || !existing.quantity) return null;
      if (qty === existing.quantity) return existing.snapshot;
      // Hitung ulang dari basis per-100 yang tersimpan di snapshot catatan ini.
      const per100 = scaleFacts(existing.snapshot, (100 / existing.quantity) * 100);
      return scaleFacts(per100, qty);
    }
    if (product) return qty === null || Number.isNaN(qty) ? null : scaleFacts(product.nutrientsPer100, qty);
    return favSnapshot;
  }, [existing, isMeal, multiplier, qty, product, favSnapshot]);

  const future = when.getTime() > Date.now();
  const timeError = future ? `Waktu belum terjadi. Pilih ${formatTime(new Date())} atau lebih awal.` : null;
  const qtyValid = isMeal || (qty !== null && !Number.isNaN(qty) && qty > 0);
  const canSave = !future && qtyValid && !!snapshot;

  const title = existing?.title ?? product?.name ?? favorite?.name ?? '';
  const subtitle = existing
    ? `Dicatat ${relativeDayLabel(toDateKey(new Date(existing.consumedAt))).toLowerCase()} ${formatTime(existing.consumedAt)}`
    : product
      ? `${product.brand ? `${product.brand}, ` : ''}${params.source === 'SCAN' ? 'dari pindaian' : product.source === 'USER_ENTERED' ? 'produk buatan saya' : 'dari pencarian'}`
      : favorite
        ? `Favorit, ${favorite.items.length} item`
        : '';

  const save = () => {
    if (!qtyValid) {
      setQtyError('Masukkan jumlah lebih dari 0.');
      return;
    }
    if (!canSave || !snapshot) return;
    const record: ConsumptionRecord = existing
      ? {
          ...existing,
          consumedAt: when.toISOString(),
          quantity: isMeal ? multiplier : (qty as number),
          snapshot,
        }
      : {
          id: newId('rec'),
          consumedAt: when.toISOString(),
          title,
          productId: product?.id,
          favoriteId: favorite?.id,
          source: params.source,
          quantity: isMeal ? multiplier : (qty as number),
          unit,
          itemsCount: favorite ? favorite.items.length : 1,
          snapshot,
          syncStatus: 'PENDING',
          version: 0,
        };
    const undo = saveRecord(record);
    toast({ message: editing ? 'Perubahan disimpan' : 'Catatan disimpan', actionLabel: 'Urungkan', onAction: undo });
    nav.navigate('Main', {
      screen: 'SummaryTab',
      params: { screen: 'SummaryHome', params: { view: 'history', date: toDateKey(when) } },
    });
  };

  const remove = () => {
    if (!existing) return;
    const undo = deleteRecord(existing.id);
    setConfirmDelete(false);
    toast({ message: 'Catatan dihapus', actionLabel: 'Urungkan', onAction: undo });
    nav.goBack();
  };

  const presets = product ? portionPresets(product.basis, product.serving).filter((p) => p.quantity !== 100) : [];
  const previewLabel = isMeal
    ? `Salinan gizi yang akan disimpan (${MULTIPLIERS.find((m) => m.value === multiplier)?.label ?? `${multiplier} porsi`})`
    : `Salinan gizi yang akan disimpan (${qty !== null && !Number.isNaN(qty) ? formatNumber(qty) : '–'} ${unit})`;
  const previewKeys = PREVIEW_KEYS.filter((k) => k !== 'sodium' || (snapshot && snapshot.sodium !== null) || future);

  if (loadError) {
    return (
      <Screen>
        <TopAppBar leading="close" onLeading={() => nav.goBack()} title="Catat konsumsi" />
        <Banner type="offline" title="Item tidak dapat dimuat" message={loadError} />
      </Screen>
    );
  }

  return (
    <Screen
      gap={14}
      keyboard
      actionBar={
        <ActionBar>
          {canSave ? (
            <Button label={editing ? 'Simpan perubahan' : 'Simpan catatan'} onPress={save} />
          ) : (
            <Button label={editing ? 'Simpan perubahan' : 'Simpan catatan'} disabled accessibilityHint={timeError ?? undefined} />
          )}
          {editing ? <Button label="Hapus catatan" icon="trash" type="destructive" onPress={() => setConfirmDelete(true)} /> : null}
        </ActionBar>
      }
      overlay={
        existing ? (
          <Dialog
            visible={confirmDelete}
            title="Hapus catatan ini?"
            message={`${existing.title} (${formatTime(existing.consumedAt)}) akan dihapus dari riwayat dan ringkasan ${relativeDayLabel(toDateKey(new Date(existing.consumedAt))).toLowerCase()}. Jika catatan berasal dari rencana, status rencana kembali menjadi direncanakan.`}
            onDismiss={() => setConfirmDelete(false)}
          >
            <Button label="Hapus catatan" icon="trash" type="destructive" onPress={remove} />
            <Button label="Batal" type="tertiary" onPress={() => setConfirmDelete(false)} />
          </Dialog>
        ) : null
      }
    >
      <TopAppBar leading="close" onLeading={() => nav.goBack()} title={editing ? 'Ubah catatan' : 'Catat konsumsi'} />

      <View style={styles.loggedItem}>
        <Tile icon={isMeal ? 'heart' : 'package'} tone={isMeal || product?.source === 'USER_ENTERED' ? 'user' : 'neutral'} />
        <View style={styles.flex}>
          <AppText variant="headline">{title || ' '}</AppText>
          <AppText variant="footnote" tone="secondary">
            {subtitle}
          </AppText>
        </View>
      </View>

      {isMeal ? (
        <View style={{ gap: 6 }}>
          <AppText variant="footnoteEmphasized">Porsi</AppText>
          <View style={styles.wrap}>
            {MULTIPLIERS.map((m) => (
              <FilterChip key={m.value} label={m.label} selected={multiplier === m.value} onPress={() => setMultiplier(m.value)} />
            ))}
          </View>
        </View>
      ) : (
        <>
          {presets.length > 0 && !editing ? (
            <View style={styles.wrap}>
              {presets.map((p) => (
                <FilterChip key={p.label} label={p.label} selected={qty === p.quantity} onPress={() => setQtyText(toInputText(p.quantity))} />
              ))}
              <FilterChip label="Lainnya" selected={qty !== null && !presets.some((p) => p.quantity === qty)} onPress={() => setQtyText('')} />
            </View>
          ) : null}
          <TextField
            label="Jumlah"
            value={qtyText}
            onChangeText={(t) => {
              setQtyText(t.replace(/[^0-9,.]/g, ''));
              setQtyError(null);
            }}
            unit={unit}
            keyboardType="decimal-pad"
            error={qtyError}
          />
        </>
      )}

      <View style={styles.dateTime}>
        <DateTimePickerField
          label="Tanggal"
          mode="date"
          value={when}
          maximumDate={new Date()}
          display={relativeDayLabel(toDateKey(when))}
          onChange={(d) => {
            const next = new Date(when);
            next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
            setWhen(next);
          }}
          style={styles.flex}
        />
        <DateTimePickerField
          label="Jam"
          mode="time"
          value={when}
          display={formatTime(when)}
          onChange={(d) => {
            const next = new Date(when);
            next.setHours(d.getHours(), d.getMinutes(), 0, 0);
            setWhen(next);
          }}
          error={timeError}
          style={styles.flex}
        />
      </View>

      {existing && existing.syncStatus !== 'SYNCED' ? <StatusChip status={syncChip[existing.syncStatus]} /> : null}

      <View>
        <AppText variant="footnoteEmphasized" tone="secondary">
          {previewLabel}
        </AppText>
        {snapshot ? (
          previewKeys.map((k, i) => <NutrientRow key={k} nutrient={k} valueA={snapshot[k]} last={i === previewKeys.length - 1} />)
        ) : (
          <AppText variant="footnote" tone="secondary" style={{ paddingTop: spacing.s }}>
            Isi jumlah untuk melihat pratinjau.
          </AppText>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.s },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  iconBox: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  loggedItem: {
    flexDirection: 'row',
    gap: spacing.m,
    alignItems: 'center',
    paddingBottom: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
  },
  dateTime: { flexDirection: 'row', gap: spacing.m, alignItems: 'flex-start' },
});

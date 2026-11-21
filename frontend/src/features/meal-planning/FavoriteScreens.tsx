/**
 * 09. Makanan Favorit — I3 detail (pakai ulang), I4 buat/ubah, I5 konfirmasi hapus.
 * Total per hidangan: bila satu item tidak punya nilai, total = "Tidak tersedia" (bukan jumlah parsial).
 */
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
import { errorMessage } from '../../shared/api/errors';
import {
  ActionBar,
  AppText,
  Banner,
  BottomSheet,
  Button,
  Dialog,
  Icon,
  IconButton,
  ListRow,
  NutrientRow,
  Screen,
  SectionHeader,
  Skeleton,
  StatusChip,
  TextField,
  Tile,
  TopAppBar,
  completenessChip,
  outcomeChip,
  useToast,
} from '../../shared/components';
import type { MealItem, MealSlot, NutrientKey, Product, ProductSummary } from '../../shared/domain/types';
import { useSession } from '../../shared/state/SessionProvider';
import { useAsync } from '../../shared/state/useAsync';
import { colors, spacing } from '../../shared/theme';
import { formatNumber } from '../../shared/utils/format';
import { catalogService } from '../../services/catalog';
import { mealPlanningService } from '../../services/mealPlanning';
import { SearchField } from '../food-catalog/components';
import { PortionSheet } from '../nutritional-assessment/PortionSheet';

const TOTAL_KEYS: NutrientKey[] = ['energy', 'sugar', 'sodium'];

/* ------------------------------ I3 ------------------------------ */

export function FavoriteDetailScreen({ route }: { route: { params: { favoriteId: string } } }) {
  const nav = useRootNav();
  const { user } = useSession();
  const fav = useAsync(() => mealPlanningService.getFavorite(route.params.favoriteId, user?.id), [route.params.favoriteId, user?.id]);
  useFocusEffect(
    useCallback(() => {
      void fav.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const f = fav.data;

  return (
    <Screen
      gap={spacing.m}
      actionBar={
        f ? (
          <ActionBar>
            <Button label="Catat konsumsi" icon="plus" onPress={() => nav.navigate('LogForm', { source: 'FAVORITE', favoriteId: f.id })} />
            <Button
              label="Tambahkan ke rencana"
              icon="calendar"
              type="secondary"
              onPress={() =>
                nav.navigate('Main', {
                  screen: 'PlanTab',
                  params: { screen: 'PlanHome', params: { view: 'calendar', addSlot: f.slotHint, addFavoriteId: f.id, nonce: Date.now() } },
                })
              }
            />
          </ActionBar>
        ) : undefined
      }
    >
      <TopAppBar
        onLeading={() => nav.goBack()}
        actions={f ? [{ icon: 'edit', label: 'Ubah favorit', onPress: () => nav.navigate('FavoriteEdit', { favoriteId: f.id }) }] : []}
      />
      {!f ? (
        fav.error ? (
          <Banner type="offline" title="Favorit belum dapat dimuat" message={errorMessage(fav.error)} actionLabel="Coba lagi" onAction={fav.reload} />
        ) : (
          <Skeleton width="100%" height={240} />
        )
      ) : (
        <>
          <AppText variant="title1" accessibilityRole="header">
            {f.name}
          </AppText>
          <View style={styles.wrap}>
            {f.outcome ? <StatusChip status={outcomeChip[f.outcome]} /> : null}
            <StatusChip status={completenessChip[f.completeness]} />
          </View>
          <SectionHeader title="Isi hidangan" variant="headline" />
          {f.items.map((it) => (
            <ItemRow key={it.productId} item={it} />
          ))}
          {f.note ? (
            <AppText variant="subheadline" tone="secondary">
              Catatan: {f.note}
            </AppText>
          ) : null}
          <View style={{ paddingTop: spacing.s }}>
            <AppText variant="footnoteEmphasized" tone="secondary">
              Total per hidangan
            </AppText>
            {TOTAL_KEYS.map((k, i) => (
              <NutrientRow key={k} nutrient={k} valueA={f.totals[k] ?? null} last={i === TOTAL_KEYS.length - 1} />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function ItemRow({ item, onPress, onRemove }: { item: MealItem; onPress?: () => void; onRemove?: () => void }) {
  const user = item.source === 'USER_ENTERED';
  return (
    <ListRow
      title={item.productName}
      titleVariant="subheadlineEmphasized"
      subtitle={`${formatNumber(item.quantity)} ${item.unit}${onPress ? ', ketuk untuk ubah porsi' : ''}`}
      leading={<Tile tone={user ? 'user' : 'neutral'} />}
      onPress={onPress}
      chevron={false}
      trailing={onRemove ? <IconButton icon="minus-circle" size={22} label={`Hapus ${item.productName}`} onPress={onRemove} /> : undefined}
    >
      {user && !onRemove ? <StatusChip status="Belum diverifikasi" style={{ marginTop: spacing.xxs }} /> : null}
    </ListRow>
  );
}

/* ------------------------------ I4 / I5 ------------------------------ */

export function FavoriteEditScreen({ route }: { route: { params?: { favoriteId?: string; productId?: string } } }) {
  const nav = useRootNav();
  const toast = useToast();
  const favoriteId = route.params?.favoriteId;
  const { user } = useSession();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<MealItem[]>([]);
  const [slotHint, setSlotHint] = useState<MealSlot | undefined>(undefined);
  const [errors, setErrors] = useState<{ name?: string; items?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [picker, setPicker] = useState(false);
  const [portionFor, setPortionFor] = useState<{ index: number; product: Product } | null>(null);

  useEffect(() => {
    if (favoriteId) {
      void mealPlanningService.getFavorite(favoriteId, user?.id).then((f) => {
        setName(f.name);
        setNote(f.note ?? '');
        setItems(f.items);
        setSlotHint(f.slotHint);
      }).catch((error) => setFormError(errorMessage(error)));
    } else if (route.params?.productId) {
      void catalogService.getProduct(route.params.productId).then((p) => {
        setName(p.name);
        if (p.basisKnown !== false) setItems([toItem(p)]);
        else setErrors({ items: 'Satuan produk belum tersedia.' });
      }).catch((error) => setFormError(errorMessage(error)));
    }
  }, [favoriteId, route.params?.productId, user?.id]);

  const openPortion = async (index: number) => {
    try {
      const product = await catalogService.getProduct(items[index].productId);
      setPortionFor({ index, product });
    } catch (e) {
      toast({ message: errorMessage(e) });
    }
  };

  const save = async () => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = 'Nama hidangan wajib diisi.';
    if (items.length === 0) e.items = 'Tambahkan minimal 1 item.';
    setErrors(e);
    if (e.name || e.items) return;
    setSaving(true);
    setFormError(null);
    try {
      await mealPlanningService.saveFavorite({ id: favoriteId, name: name.trim(), items, note: note.trim() || undefined, slotHint });
      toast({ message: 'Favorit disimpan' });
      nav.goBack();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!favoriteId) return;
    setSaving(true);
    try {
      await mealPlanningService.deleteFavorite(favoriteId);
      setConfirm(false);
      toast({ message: 'Favorit dihapus' });
      nav.navigate('Main', { screen: 'PlanTab', params: { screen: 'PlanHome', params: { view: 'favorites' } } });
    } catch (err) {
      setConfirm(false);
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      gap={14}
      keyboard
      actionBar={
        <ActionBar>
          <Button label="Simpan" onPress={save} loading={saving && !confirm} />
        </ActionBar>
      }
      overlay={
        <>
          <Dialog
            visible={confirm}
            title={`Hapus “${name}”?`}
            message="Favorit ini akan dihapus. Rencana makan dan Catatan Konsumsi yang sudah memakai hidangan ini tidak ikut terhapus."
            onDismiss={() => setConfirm(false)}
          >
            <Button label="Hapus favorit" icon="trash" type="destructive" onPress={remove} loading={saving} />
            <Button label="Batal" type="tertiary" onPress={() => setConfirm(false)} />
          </Dialog>
          <ItemPicker
            visible={picker}
            onClose={() => setPicker(false)}
            onPick={(p) => {
              if (p.basisKnown === false) {
                toast({ message: 'Satuan produk belum tersedia.' });
                return;
              }
              setPicker(false);
              setItems((prev) => [...prev.filter((x) => x.productId !== p.id), toItem(p)]);
              setErrors((er) => ({ ...er, items: undefined }));
            }}
          />
          {portionFor ? (
            <PortionSheet
              visible
              onClose={() => setPortionFor(null)}
              basis={portionFor.product.basis}
              serving={portionFor.product.serving}
              initialQuantity={items[portionFor.index]?.quantity}
              title="Ubah porsi"
              submitLabel="Simpan porsi"
              onSubmit={(q) => {
                setItems((prev) => prev.map((it, i) => (i === portionFor.index ? { ...it, quantity: q } : it)));
                setPortionFor(null);
              }}
            />
          ) : null}
        </>
      }
    >
      <TopAppBar leading="close" onLeading={() => nav.goBack()} title={favoriteId ? 'Ubah favorit' : 'Buat favorit'} />
      {formError ? <Banner type="offline" title="Belum tersimpan" message={formError} /> : null}
      <TextField label="Nama hidangan" value={name} onChangeText={setName} error={errors.name} autoFocus={!favoriteId && !route.params?.productId} />
      <AppText variant="footnoteEmphasized">Isi hidangan</AppText>
      {items.map((it, i) => (
        <ItemRow key={it.productId} item={it} onPress={() => void openPortion(i)} onRemove={() => setItems(items.filter((_, j) => j !== i))} />
      ))}
      {errors.items ? (
        <AppText variant="footnote" tone="error">
          {errors.items}
        </AppText>
      ) : null}
      <Button label="Tambah item" icon="plus" type="secondary" onPress={() => setPicker(true)} />
      <TextField label="Catatan (opsional)" value={note} onChangeText={setNote} multiline />
      {favoriteId ? (
        <Pressable onPress={() => setConfirm(true)} accessibilityRole="button" style={styles.deleteLink} hitSlop={8}>
          <Icon name="trash" size={18} color={colors.stateError} />
          <AppText variant="subheadlineEmphasized" tone="error">
            Hapus favorit
          </AppText>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function toItem(p: Product): MealItem {
  const unit = p.basis === 'MASS' ? 'g' : 'ml';
  return {
    productId: p.id,
    productName: p.name,
    quantity: p.serving && p.serving.unit === unit ? p.serving.quantity : 100,
    unit,
    source: p.source,
  };
}

function ItemPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (p: Product) => void }) {
  const [query, setQuery] = useState('');
  const toast = useToast();
  const results = useAsync<ProductSummary[]>(() => catalogService.search(query, 'ALL'), [query], { enabled: visible });
  return (
    <BottomSheet visible={visible} title="Tambah item" onClose={onClose}>
      <SearchField value={query} onChangeText={setQuery} placeholder="Cari produk" />
      {results.error ? (
        <Banner type="offline" title="Pencarian butuh koneksi internet" />
      ) : (
        (results.data ?? []).slice(0, 8).map((p) => (
          <ListRow
            key={p.id}
            title={p.name}
            subtitle={p.brand}
            leading={<Tile tone={p.source === 'USER_ENTERED' ? 'user' : 'neutral'} />}
            onPress={() => void catalogService.getProduct(p.id).then(onPick).catch((error) => toast({ message: errorMessage(error) }))}
          />
        ))
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  deleteLink: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-start', paddingTop: spacing.s, minHeight: 44 },
});

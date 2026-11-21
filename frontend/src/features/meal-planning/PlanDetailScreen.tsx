/**
 * J4 Detail rencana · J5 Tandai dikonsumsi (sheet).
 * Rencana TIDAK pernah otomatis menjadi catatan: konfirmasi eksplisit, waktu default sekarang,
 * masa depan diblokir, porsi boleh berbeda (hanya memengaruhi Catatan Konsumsi baru).
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
import {
  ActionBar,
  AppText,
  BottomSheet,
  Button,
  Dialog,
  FilterChip,
  Icon,
  InfoNote,
  ListRow,
  Screen,
  SectionHeader,
  StatusChip,
  Tile,
  TopAppBar,
  outcomeChip,
  syncChip,
  useToast,
} from '../../shared/components';
import { SLOT_LABEL } from '../../shared/domain/nutrients';
import type { MealPlanEntry } from '../../shared/domain/types';
import { useCatalogLocal } from '../../shared/state/CatalogLocalProvider';
import { newId } from '../../shared/sync/queue';
import { useOfflineData } from '../../shared/sync/OfflineDataProvider';
import { colors, radius, spacing } from '../../shared/theme';
import { formatDayShortMonth, formatTime, relativeDayLabel, todayKey } from '../../shared/utils/date';
import { formatNumber } from '../../shared/utils/format';
import { DateTimePickerField } from '../consumption-history/DateTimePickerField';
import { snapshotForItems } from '../consumption-history/snapshot';
import { AddToSlotSheet } from './AddToSlotSheet';

export function PlanDetailScreen({ route }: { route: { params: { planId: string; markConsumed?: boolean } } }) {
  const nav = useRootNav();
  const toast = useToast();
  const { plans, deletePlan } = useOfflineData();
  const entry = plans.find((p) => p.id === route.params.planId);
  const [markOpen, setMarkOpen] = useState(!!route.params.markConsumed);
  const [confirm, setConfirm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (!entry) {
    return (
      <Screen>
        <TopAppBar onLeading={() => nav.goBack()} />
        <AppText variant="subheadline" tone="secondary">
          Rencana ini sudah tidak ada.
        </AppText>
      </Screen>
    );
  }

  const consumed = entry.status === 'CONSUMED';
  const isFuture = entry.date > todayKey();
  const single = entry.items.length === 1 ? entry.items[0] : null;

  const remove = () => {
    const undo = deletePlan(entry.id);
    setConfirm(false);
    toast({ message: 'Dihapus dari rencana', actionLabel: 'Urungkan', onAction: undo });
    nav.goBack();
  };

  return (
    <Screen
      gap={spacing.m}
      actionBar={
        <ActionBar>
          {consumed ? (
            <Button
              label="Lihat catatan konsumsi"
              type="secondary"
              onPress={() => nav.navigate('Main', { screen: 'SummaryTab', params: { screen: 'SummaryHome', params: { view: 'history' } } })}
            />
          ) : (
            <Button
              label="Tandai dikonsumsi"
              icon="check"
              onPress={() => setMarkOpen(true)}
              disabled={isFuture}
              accessibilityHint={isFuture ? 'Rencana untuk hari mendatang belum bisa ditandai dikonsumsi' : undefined}
            />
          )}
          <Button label="Hapus dari rencana" type="tertiary" onPress={() => setConfirm(true)} />
        </ActionBar>
      }
      overlay={
        <>
          <MarkConsumedSheet visible={markOpen} entry={entry} onClose={() => setMarkOpen(false)} />
          <AddToSlotSheet visible={editOpen} date={entry.date} slot={entry.slot} favoriteId={entry.favoriteId} onClose={() => setEditOpen(false)} replaceId={entry.id} />
          <Dialog
            visible={confirm}
            title="Hapus dari rencana?"
            message={`${entry.title} akan dihapus dari ${SLOT_LABEL[entry.slot]}, ${formatDayShortMonth(entry.date)}. Catatan Konsumsi yang sudah dibuat tidak ikut terhapus.`}
            onDismiss={() => setConfirm(false)}
          >
            <Button label="Hapus dari rencana" icon="trash" type="destructive" onPress={remove} />
            <Button label="Batal" type="tertiary" onPress={() => setConfirm(false)} />
          </Dialog>
        </>
      }
    >
      <TopAppBar
        onLeading={() => nav.goBack()}
        actions={consumed ? [] : [{ icon: 'edit', label: 'Ubah rencana', onPress: () => setEditOpen(true) }]}
      />
      <AppText variant="footnoteEmphasized" tone="secondary">
        {SLOT_LABEL[entry.slot]}, {formatDayShortMonth(entry.date)}
      </AppText>
      <AppText variant="title1" accessibilityRole="header">
        {entry.title}
      </AppText>
      <View style={styles.wrap}>
        {consumed ? (
          <View style={[styles.stateChip, { backgroundColor: colors.neutralGreenGray }]} accessible accessibilityLabel="Dikonsumsi">
            <Icon name="consumed" size={16} />
            <AppText variant="footnoteEmphasized">Dikonsumsi {entry.consumedAt ? formatTime(entry.consumedAt) : ''}</AppText>
          </View>
        ) : (
          <View style={[styles.stateChip, styles.planned]} accessible accessibilityLabel="Direncanakan, belum menjadi catatan konsumsi">
            <Icon name="planned" size={16} />
            <AppText variant="footnoteEmphasized">Direncanakan</AppText>
          </View>
        )}
        {entry.outcome ? <StatusChip status={outcomeChip[entry.outcome]} /> : null}
        {entry.syncStatus !== 'SYNCED' ? <StatusChip status={syncChip[entry.syncStatus]} /> : null}
      </View>
      {single && entry.outcome ? (
        <Pressable
          onPress={() => nav.navigate('AssessmentResult', { productId: single.productId, quantity: single.quantity, unit: single.unit })}
          accessibilityRole="link"
          style={styles.link}
        >
          <AppText variant="subheadlineEmphasized">Lihat bukti penilaian</AppText>
          <Icon name="chev-right" size={16} />
        </Pressable>
      ) : null}

      <SectionHeader title="Isi hidangan" variant="headline" />
      {entry.items.map((it) => (
        <ListRow
          key={it.productId}
          title={it.productName}
          subtitle={`${formatNumber(it.quantity)} ${it.unit}`}
          leading={<Tile tone={it.source === 'USER_ENTERED' ? 'user' : 'neutral'} />}
          onPress={() => nav.navigate('ProductDetail', { productId: it.productId })}
          chevron={false}
        />
      ))}

      <Pressable
        onPress={() => nav.navigate('LocationPermission', { planId: entry.id })}
        accessibilityRole="button"
        accessibilityLabel="Makan di luar? Cari restoran terdekat lewat Ambatueat"
        style={styles.restaurant}
      >
        <Icon name="restaurant" size={22} />
        <View style={styles.flex}>
          <AppText variant="subheadlineEmphasized">Makan di luar?</AppText>
          <AppText variant="footnote" tone="secondary">
            Cari restoran terdekat yang menyajikan hidangan ini lewat Ambatueat.
          </AppText>
        </View>
        <Icon name="chev-right" size={20} />
      </Pressable>
    </Screen>
  );
}

/* ------------------------------ J5 ------------------------------ */

const PORTION_OPTIONS = [
  { label: '½ porsi', value: 0.5 },
  { label: 'Sesuai rencana', value: 1 },
  { label: '1½ porsi', value: 1.5 },
  { label: '2 porsi', value: 2 },
];

function MarkConsumedSheet({ visible, entry, onClose }: { visible: boolean; entry: MealPlanEntry; onClose: () => void }) {
  const toast = useToast();
  const { markConsumed } = useOfflineData();
  const { cachedProduct } = useCatalogLocal();
  const [when, setWhen] = useState(new Date());
  const [multiplier, setMultiplier] = useState(1);
  const [adjust, setAdjust] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      const now = new Date();
      // Rencana hari lampau: default jam sekarang pada tanggal rencana.
      const [y, m, d] = entry.date.split('-').map(Number);
      const base = new Date(y, m - 1, d, now.getHours(), now.getMinutes());
      setWhen(base > now ? now : base);
      setMultiplier(1);
      setAdjust(false);
      setError(null);
    }
  }, [visible, entry.date]);

  const save = async () => {
    if (when.getTime() > Date.now()) {
      setError(`Waktu belum terjadi. Pilih ${formatTime(new Date())} atau lebih awal.`);
      return;
    }
    setSaving(true);
    const snapshot = await snapshotForItems(entry.items, multiplier, cachedProduct);
    const undo = markConsumed(entry.id, {
      id: newId('rec'),
      consumedAt: when.toISOString(),
      title: entry.title,
      favoriteId: entry.favoriteId,
      planEntryId: entry.id,
      source: 'PLAN',
      quantity: entry.items.length === 1 ? entry.items[0].quantity * multiplier : multiplier,
      unit: entry.items[0]?.unit ?? 'g',
      itemsCount: entry.items.length,
      snapshot,
      syncStatus: 'PENDING',
      version: 0,
    });
    setSaving(false);
    onClose();
    toast({ message: 'Dicatat', actionLabel: 'Urungkan', onAction: undo });
  };

  const portionLabel =
    multiplier === 1
      ? `Sesuai rencana, ${entry.items.length} item`
      : `${PORTION_OPTIONS.find((o) => o.value === multiplier)?.label}, ${entry.items.length} item`;

  return (
    <BottomSheet visible={visible} title="Sudah dimakan?" onClose={onClose}>
      <View style={styles.sheetRow}>
        <Icon name="clock" size={22} />
        <View style={styles.flex}>
          <DateTimePickerField
            label="Waktu makan"
            mode="time"
            value={when}
            display={`${relativeDayLabel(entry.date)}, ${formatTime(when)}`}
            onChange={(d) => {
              const next = new Date(when);
              next.setHours(d.getHours(), d.getMinutes(), 0, 0);
              setWhen(next);
              setError(next.getTime() > Date.now() ? `Waktu belum terjadi. Pilih ${formatTime(new Date())} atau lebih awal.` : null);
            }}
            error={error}
          />
        </View>
      </View>
      <View style={styles.sheetRow}>
        <Icon name="package" size={22} />
        <View style={styles.flex}>
          <AppText variant="footnote" tone="secondary">
            Porsi
          </AppText>
          <AppText variant="headline">{portionLabel}</AppText>
        </View>
        <Pressable onPress={() => setAdjust((a) => !a)} accessibilityRole="button" hitSlop={10}>
          <AppText variant="subheadlineEmphasized">Sesuaikan</AppText>
        </Pressable>
      </View>
      {adjust ? (
        <View style={styles.wrap}>
          {PORTION_OPTIONS.map((o) => (
            <FilterChip key={o.value} label={o.label} selected={multiplier === o.value} onPress={() => setMultiplier(o.value)} />
          ))}
        </View>
      ) : null}
      <InfoNote tone="greenGray">
        Ini akan membuat Catatan Konsumsi dan dihitung dalam ringkasan hari ini. Rencana tetap tersimpan.
      </InfoNote>
      <Button label="Simpan sebagai dikonsumsi" onPress={save} loading={saving} disabled={!!error} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, alignItems: 'center' },
  stateChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 5, paddingBottom: 5, paddingLeft: 8, paddingRight: 10, borderRadius: radius.chip },
  planned: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.labelSecondary },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
  restaurant: {
    flexDirection: 'row',
    gap: spacing.m,
    padding: 14,
    borderRadius: radius.surface,
    backgroundColor: colors.neutralYellowGray,
    alignItems: 'center',
    marginTop: spacing.s,
  },
  sheetRow: {
    flexDirection: 'row',
    gap: spacing.m,
    alignItems: 'center',
    paddingVertical: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
  },
});

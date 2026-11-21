/**
 * Tab Rencana: Kalender (J1 harian, J2 mingguan, J3 sheet) dan Favorit (I1 daftar, I2 kosong).
 * Rencana ≠ catatan konsumsi: Direncanakan = garis putus-putus + ikon ◌;
 * Dikonsumsi = tint + ikon ● + waktu (bentuk DAN label berbeda, bukan warna saja).
 */
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
import {
  AppText,
  Button,
  Icon,
  ListRow,
  Screen,
  SegmentedControl,
  StatusChip,
  SubNavigation,
  Tile,
  outcomeChip,
  syncChip,
} from '../../shared/components';
import { SLOT_LABEL, SLOT_ORDER, SLOT_SHORT } from '../../shared/domain/nutrients';
import type { MealPlanEntry, MealSlot } from '../../shared/domain/types';
import { useAsync } from '../../shared/state/useAsync';
import { useOfflineData } from '../../shared/sync/OfflineDataProvider';
import { colors, radius, spacing } from '../../shared/theme';
import { addDays, dayShort, formatTime, formatWeekRange, fromDateKey, todayKey, weekDays } from '../../shared/utils/date';
import { mealPlanningService } from '../../services/mealPlanning';
import { AddToSlotSheet, type PrefillProduct } from './AddToSlotSheet';

type Params = {
  view?: 'calendar' | 'favorites';
  date?: string;
  addSlot?: MealSlot;
  addProduct?: PrefillProduct;
  addFavoriteId?: string;
  nonce?: number;
};

export function PlanHomeScreen({ route }: { route: { params?: Params } }) {
  const params = route.params ?? {};
  const [view, setView] = useState<'calendar' | 'favorites'>(params.view ?? 'calendar');
  const [mode, setMode] = useState<'daily' | 'weekly'>('daily');
  const [date, setDate] = useState(params.date ?? todayKey());
  const [sheet, setSheet] = useState<{ date: string; slot: MealSlot; prefill?: PrefillProduct; favoriteId?: string } | null>(null);

  // Param dari layar lain (Beranda +, F2 "Tambah ke rencana makan").
  useEffect(() => {
    if (params.view) setView(params.view);
    if (params.date) setDate(params.date);
    if (params.addSlot || params.addProduct || params.addFavoriteId) {
      setView('calendar');
      setSheet({
        date: params.date ?? todayKey(),
        slot: params.addSlot ?? 'MAKAN_SIANG',
        prefill: params.addProduct,
        favoriteId: params.addFavoriteId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.view, params.date, params.addSlot, params.nonce]);

  return (
    <Screen
      inTabs
      gap={spacing.m}
      overlay={
        sheet ? (
          <AddToSlotSheet
            visible
            date={sheet.date}
            slot={sheet.slot}
            prefill={sheet.prefill}
            favoriteId={sheet.favoriteId}
            onClose={() => setSheet(null)}
          />
        ) : null
      }
    >
      <AppText variant="largeTitle" accessibilityRole="header">
        Rencana Makan
      </AppText>
      <SubNavigation
        items={[
          { value: 'calendar', label: 'Kalender' },
          { value: 'favorites', label: 'Favorit' },
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'calendar' ? (
        <>
          <SegmentedControl
            accessibilityLabel="Tampilan kalender"
            options={[
              { value: 'daily', label: 'Harian' },
              { value: 'weekly', label: 'Mingguan' },
            ]}
            value={mode}
            onChange={setMode}
          />
          {mode === 'daily' ? (
            <DailyView date={date} onSelectDate={setDate} onAdd={(slot) => setSheet({ date, slot })} />
          ) : (
            <WeeklyView
              date={date}
              onWeek={(d) => setDate(d)}
              onAdd={(d, slot) => setSheet({ date: d, slot })}
              onOpenDay={(d) => {
                setDate(d);
                setMode('daily');
              }}
            />
          )}
        </>
      ) : (
        <FavoritesView />
      )}
    </Screen>
  );
}

/* ------------------------------ J1 ------------------------------ */

function DailyView({ date, onSelectDate, onAdd }: { date: string; onSelectDate: (d: string) => void; onAdd: (slot: MealSlot) => void }) {
  const nav = useRootNav();
  const { plans } = useOfflineData();
  const today = todayKey();
  const days = weekDays(date);
  const isFuture = date > today;

  return (
    <>
      <View style={styles.weekStrip} accessibilityRole="tablist">
        {days.map((d) => {
          const selected = d === date;
          const isToday = d === today;
          return (
            <Pressable
              key={d}
              onPress={() => onSelectDate(d)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${dayShort(d)} ${fromDateKey(d).getDate()}${isToday ? ', hari ini' : ''}`}
              style={[styles.day, selected && styles.daySelected, isToday && !selected && styles.dayToday]}
            >
              <AppText variant="caption1" tone={selected ? 'inverse' : 'secondary'}>
                {dayShort(d)}
              </AppText>
              <AppText variant="headline" tone={selected ? 'inverse' : 'primary'}>
                {fromDateKey(d).getDate()}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <Legend />
      {SLOT_ORDER.map((slot) => {
        const entries = plans.filter((p) => p.date === date && p.slot === slot);
        return (
          <View key={slot} style={styles.slotSection}>
            <View style={styles.slotHeader}>
              <AppText variant="headline" style={styles.flex} accessibilityRole="header">
                {SLOT_LABEL[slot]}
              </AppText>
              <Pressable onPress={() => onAdd(slot)} accessibilityRole="button" accessibilityLabel={`Tambah ke ${SLOT_LABEL[slot]}`} style={styles.addBtn} hitSlop={4}>
                <Icon name="plus" size={18} />
              </Pressable>
            </View>
            {entries.length === 0 ? (
              <AppText variant="subheadlineItalic" tone="secondary">
                Belum ada rencana
              </AppText>
            ) : (
              entries.map((e) => (
                <PlanEntryCard
                  key={e.id}
                  entry={e}
                  canMarkConsumed={!isFuture}
                  onOpen={() => nav.navigate('PlanDetail', { planId: e.id })}
                  onMarkConsumed={() => nav.navigate('PlanDetail', { planId: e.id, markConsumed: true })}
                />
              ))
            )}
          </View>
        );
      })}
    </>
  );
}

function PlanEntryCard({
  entry,
  canMarkConsumed,
  onOpen,
  onMarkConsumed,
}: {
  entry: MealPlanEntry;
  canMarkConsumed: boolean;
  onOpen: () => void;
  onMarkConsumed: () => void;
}) {
  const consumed = entry.status === 'CONSUMED';
  const needsSyncChip = entry.syncStatus !== 'SYNCED';
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, ${consumed ? `dikonsumsi ${entry.consumedAt ? formatTime(entry.consumedAt) : ''}` : 'direncanakan'}`}
      style={[styles.entry, consumed ? styles.entryConsumed : styles.entryPlanned]}
    >
      <Icon name={consumed ? 'consumed' : 'planned'} size={24} />
      <View style={[styles.flex, { gap: spacing.xs }]}>
        <AppText variant="subheadlineEmphasized">{entry.title}</AppText>
        <AppText variant="footnote" tone="secondary">
          {consumed
            ? `Dikonsumsi ${entry.consumedAt ? formatTime(entry.consumedAt) : ''}, dari rencana`
            : `Direncanakan, ${entry.items.length > 1 ? '1 porsi' : `${entry.items[0]?.quantity ?? ''} ${entry.items[0]?.unit ?? ''}`}`}
        </AppText>
        {needsSyncChip || (!consumed && (entry.outcome || canMarkConsumed)) ? (
          <View style={styles.wrap}>
            {needsSyncChip ? <StatusChip status={syncChip[entry.syncStatus]} /> : null}
            {!consumed && entry.outcome ? <StatusChip status={outcomeChip[entry.outcome]} /> : null}
            {!consumed && canMarkConsumed ? (
              <Pressable onPress={onMarkConsumed} accessibilityRole="button" hitSlop={10}>
                <AppText variant="footnoteEmphasized">Tandai dikonsumsi</AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function Legend({ withEmpty }: { withEmpty?: boolean }) {
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <Icon name="consumed" size={16} />
        <AppText variant="caption1">Dikonsumsi</AppText>
      </View>
      <View style={styles.legendItem}>
        <Icon name="planned" size={16} />
        <AppText variant="caption1">Direncanakan</AppText>
      </View>
      {withEmpty ? (
        <View style={styles.legendItem}>
          <Icon name="plus" size={14} />
          <AppText variant="caption1">Kosong</AppText>
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------ J2 ------------------------------ */

function WeeklyView({
  date,
  onWeek,
  onAdd,
  onOpenDay,
}: {
  date: string;
  onWeek: (d: string) => void;
  onAdd: (d: string, slot: MealSlot) => void;
  onOpenDay: (d: string) => void;
}) {
  const nav = useRootNav();
  const { plans } = useOfflineData();
  const { fontScale } = useWindowDimensions();
  const today = todayKey();
  const days = weekDays(date);
  const byKey = useMemo(() => {
    const m = new Map<string, MealPlanEntry>();
    plans.forEach((p) => {
      const k = `${p.date}|${p.slot}`;
      // Bila ada beberapa entri, tampilkan status "dikonsumsi" bila salah satu sudah dikonsumsi.
      const prev = m.get(k);
      if (!prev || p.status === 'CONSUMED') m.set(k, p);
    });
    return m;
  }, [plans]);

  const cellA11y = (d: string, slot: MealSlot, e?: MealPlanEntry) =>
    `${dayShort(d)} ${fromDateKey(d).getDate()}, ${SLOT_LABEL[slot]}, ${e ? (e.status === 'CONSUMED' ? 'dikonsumsi' : 'direncanakan') : 'kosong'}`;

  const header = (
    <View style={styles.weekNav}>
      <Pressable onPress={() => onWeek(addDays(days[0], -7))} accessibilityRole="button" accessibilityLabel="Minggu sebelumnya" style={styles.navBtn}>
        <Icon name="back" size={20} />
      </Pressable>
      <AppText variant="headline" align="center" style={styles.flex}>
        {formatWeekRange(date)}
      </AppText>
      <Pressable onPress={() => onWeek(addDays(days[0], 7))} accessibilityRole="button" accessibilityLabel="Minggu berikutnya" style={styles.navBtn}>
        <Icon name="chev-right" size={20} />
      </Pressable>
    </View>
  );

  // Teks ≥130%: matriks menjadi daftar per hari.
  if (fontScale >= 1.3) {
    return (
      <>
        {header}
        {days.map((d) => (
          <View key={d} style={styles.slotSection}>
            <Pressable onPress={() => onOpenDay(d)} accessibilityRole="button">
              <AppText variant="headline">{`${dayShort(d)} ${fromDateKey(d).getDate()}${d === today ? ' (hari ini)' : ''}`}</AppText>
            </Pressable>
            {SLOT_ORDER.map((slot) => {
              const e = byKey.get(`${d}|${slot}`);
              return (
                <ListRow
                  key={slot}
                  title={SLOT_LABEL[slot]}
                  subtitle={e ? e.title : 'Kosong'}
                  leading={<Icon name={e ? (e.status === 'CONSUMED' ? 'consumed' : 'planned') : 'plus'} size={22} />}
                  onPress={() => (e ? nav.navigate('PlanDetail', { planId: e.id }) : onAdd(d, slot))}
                />
              );
            })}
          </View>
        ))}
      </>
    );
  }

  return (
    <>
      {header}
      <View style={[styles.matrixRow, styles.matrixHeader]}>
        <View style={styles.dayCol}>
          <AppText variant="caption1Emphasized" tone="secondary">
            Hari
          </AppText>
        </View>
        {SLOT_ORDER.map((s) => (
          <View key={s} style={styles.cellCol}>
            <AppText variant="caption1Emphasized" tone="secondary">
              {SLOT_SHORT[s]}
            </AppText>
          </View>
        ))}
      </View>
      {days.map((d) => {
        const isToday = d === today;
        return (
          <View key={d} style={[styles.matrixRow, styles.matrixDataRow, isToday && styles.todayRow]}>
            <Pressable onPress={() => onOpenDay(d)} accessibilityRole="button" accessibilityLabel={`Buka ${dayShort(d)} ${fromDateKey(d).getDate()}`} style={[styles.dayCol, { paddingLeft: 6 }]}>
              <AppText variant={isToday ? 'subheadlineEmphasized' : 'subheadline'}>{`${dayShort(d)} ${fromDateKey(d).getDate()}`}</AppText>
            </Pressable>
            {SLOT_ORDER.map((slot) => {
              const e = byKey.get(`${d}|${slot}`);
              return (
                <Pressable
                  key={slot}
                  onPress={() => (e ? nav.navigate('PlanDetail', { planId: e.id }) : onAdd(d, slot))}
                  accessibilityRole="button"
                  accessibilityLabel={cellA11y(d, slot, e)}
                  style={[styles.cellCol, styles.cell]}
                >
                  {e ? <Icon name={e.status === 'CONSUMED' ? 'consumed' : 'planned'} size={22} /> : <Icon name="plus" size={18} />}
                </Pressable>
              );
            })}
          </View>
        );
      })}
      <Legend withEmpty />
    </>
  );
}

/* ------------------------------ I1 / I2 ------------------------------ */

function FavoritesView() {
  const nav = useRootNav();
  const favs = useAsync(() => mealPlanningService.listFavorites(), []);
  useFocusEffect(
    useCallback(() => {
      void favs.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const list = favs.data ?? [];

  if (!favs.loading && list.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyMark}>
          <Icon name="heart" size={28} />
        </View>
        <AppText variant="title2">Simpan makanan yang sering Anda makan</AppText>
        <AppText variant="subheadline" tone="secondary">
          Favorit membuat pencatatan dan perencanaan jauh lebih cepat: cukup pilih, tanpa memindai ulang.
        </AppText>
        <Button label="Buat favorit" icon="plus" onPress={() => nav.navigate('FavoriteEdit')} />
        <AppText variant="footnote" tone="secondary">
          Atau ketuk ikon hati pada halaman produk.
        </AppText>
      </View>
    );
  }

  return (
    <>
      <View style={styles.favHeader}>
        <AppText variant="footnoteEmphasized" tone="secondary" style={styles.flex}>
          {list.length} hidangan favorit
        </AppText>
        <Pressable onPress={() => nav.navigate('FavoriteEdit')} accessibilityRole="button" hitSlop={10}>
          <AppText variant="subheadlineEmphasized">Buat baru</AppText>
        </Pressable>
      </View>
      {list.map((f) => (
        <ListRow
          key={f.id}
          title={f.name}
          subtitle={`${f.slotHint ? `${SLOT_LABEL[f.slotHint]}, ` : ''}${f.items.length} item`}
          leading={<Tile icon="heart" tone="user" />}
          onPress={() => nav.navigate('FavoriteDetail', { favoriteId: f.id })}
        >
          {f.outcome ? <StatusChip status={outcomeChip[f.outcome]} style={{ marginTop: spacing.xxs }} /> : null}
        </ListRow>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  day: { flex: 1, maxWidth: 48, height: 60, borderRadius: radius.surface, alignItems: 'center', justifyContent: 'center', gap: 2 },
  daySelected: { backgroundColor: colors.labelPrimary },
  dayToday: { borderWidth: 1.5, borderColor: colors.labelPrimary },
  legend: { flexDirection: 'row', gap: spacing.m, alignItems: 'center', flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  slotSection: { gap: spacing.s, paddingVertical: spacing.m, borderBottomWidth: 1, borderBottomColor: colors.labelQuaternary },
  slotHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  addBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.labelSecondary, alignItems: 'center', justifyContent: 'center' },
  entry: { flexDirection: 'row', gap: spacing.m, padding: spacing.m, borderRadius: radius.surface, alignItems: 'flex-start' },
  entryConsumed: { backgroundColor: colors.neutralGreenGray },
  entryPlanned: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.labelSecondary },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  matrixRow: { flexDirection: 'row', alignItems: 'center' },
  matrixHeader: { paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.labelQuaternary },
  matrixDataRow: { paddingVertical: spacing.s, borderBottomWidth: 1, borderBottomColor: colors.labelQuaternary },
  todayRow: { backgroundColor: colors.neutralGreenGray, borderBottomColor: 'transparent' },
  dayCol: { width: 82 },
  cellCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cell: { minHeight: 44 },
  empty: { gap: 10, paddingTop: spacing.xl },
  emptyMark: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.neutralOrangeGray, alignItems: 'center', justifyContent: 'center' },
  favHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
});

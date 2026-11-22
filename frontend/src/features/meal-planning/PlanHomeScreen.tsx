/** Kalender makan, dengan ikon dan label status pada setiap rencana. */
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
import {
  ActionLink,
  AppText,
  Banner,
  Icon,
  ListRow,
  Screen,
  SegmentedControl,
  Skeleton,
  StatusChip,
  SubNavigation,
  Tile,
  outcomeChip,
  syncChip,
} from '../../shared/components';
import { SLOT_LABEL, SLOT_ORDER, SLOT_SHORT } from '../../shared/domain/nutrients';
import type { MealPlanEntry, MealSlot } from '../../shared/domain/types';
import { useSession } from '../../shared/state/SessionProvider';
import { useAsync } from '../../shared/state/useAsync';
import { useOfflineData } from '../../shared/sync/OfflineDataProvider';
import { CONTENT_MAX_WIDTH, MIN_TOUCH, colors, radius, spacing } from '../../shared/theme';
import { addDays, dayShort, formatDayShortMonth, formatTime, formatWeekRange, fromDateKey, todayKey, weekDays } from '../../shared/utils/date';
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
      <View style={styles.heading}>
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
      </View>
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
  const isFuture = date > today;

  return (
    <>
      <WeekStrip date={date} today={today} onSelect={onSelectDate} />
      <AppText variant="title2" accessibilityRole="header">{formatDayShortMonth(date)}</AppText>
      {SLOT_ORDER.map((slot) => {
        const entries = plans.filter((p) => p.date === date && p.slot === slot);
        return (
          <View key={slot} style={styles.slotSection}>
            <View style={styles.slotHeader}>
              <AppText variant="headline" style={styles.flex} accessibilityRole="header">
                {SLOT_LABEL[slot]}
              </AppText>
              <Pressable onPress={() => onAdd(slot)} accessibilityRole="button" accessibilityLabel={`Tambah ke ${SLOT_LABEL[slot]}`} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
                <Icon name="plus" size={18} />
              </Pressable>
            </View>
            {entries.length === 0 ? (
              <AppText variant="subheadlineItalic" tone="secondary">
                Belum ada rencana
              </AppText>
            ) : (
              entries.map((e) => (
                <PlanEntryRow
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

function WeekStrip({ date, today, onSelect }: { date: string; today: string; onSelect: (date: string) => void }) {
  const { width, fontScale } = useWindowDimensions();
  const days = weekDays(date);
  const contentWidth = Math.min(width, CONTENT_MAX_WIDTH) - spacing.screen * 2;
  const compact = fontScale > 1.3 || contentWidth < MIN_TOUCH * 7 + spacing.xxs * 6;
  const dayWidth = compact ? Math.floor((contentWidth - spacing.xxs * 3) / 4) : undefined;

  const buttons = days.map((day) => {
    const active = date === day;
    const isToday = day === today;
    return (
      <Pressable
        key={day}
        onPress={() => onSelect(day)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${formatDayShortMonth(day)}${isToday ? ', hari ini' : ''}`}
        style={[styles.day, compact ? { width: dayWidth } : styles.dayFluid,
          active ? styles.daySelected : isToday ? styles.dayToday : undefined]}
      >
        <AppText variant="caption1" tone={active ? 'inverse' : 'secondary'}>{dayShort(day)}</AppText>
        <AppText variant="headline" tone={active ? 'inverse' : 'primary'} style={styles.dayNumber}>
          {fromDateKey(day).getDate()}
        </AppText>
      </Pressable>
    );
  });

  return <View style={[styles.weekStrip, compact && styles.weekStripWrap]} accessibilityRole="tablist">{buttons}</View>;
}

function PlanEntryRow({
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
  const needsSync = entry.syncStatus !== 'SYNCED';
  const status = consumed
    ? entry.consumedAt ? `Dikonsumsi ${formatTime(entry.consumedAt)}` : 'Dikonsumsi'
    : 'Direncanakan';
  const portions = entry.items.length === 1 ? `${entry.items[0].quantity} ${entry.items[0].unit}` : `${entry.items.length} item`;

  return (
    <View style={[styles.planRow, consumed && styles.entryConsumed]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${entry.title}, ${status}, ${portions}`}
        style={({ pressed }) => [styles.entry, pressed && styles.pressed]}
      >
        <Icon name={consumed ? 'consumed' : 'planned'} size={22} color={colors.brandGreen} />
        <View style={styles.flex}>
          <AppText variant="subheadlineEmphasized">{entry.title}</AppText>
          <AppText variant="footnote" tone="secondary">{status} · {portions}</AppText>
        </View>
        <Icon name="chev-right" size={18} color={colors.labelSecondary} />
      </Pressable>
      {needsSync || (!consumed && (entry.outcome || canMarkConsumed)) ? (
        <View style={styles.entryActions}>
          {needsSync ? <StatusChip status={syncChip[entry.syncStatus]} /> : null}
          {!consumed && entry.outcome ? <StatusChip status={outcomeChip[entry.outcome]} /> : null}
          {!consumed && canMarkConsumed ? <ActionLink label="Tandai dikonsumsi" chevron={false} onPress={onMarkConsumed} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Legend() {
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
      <View style={styles.legendItem}>
        <Icon name="plus" size={14} />
        <AppText variant="caption1">Kosong</AppText>
      </View>
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
  const { width, fontScale } = useWindowDimensions();
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
  if (width < 350 || fontScale >= 1.3) {
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
            <Pressable onPress={() => onOpenDay(d)} accessibilityRole="button" accessibilityLabel={`Buka ${dayShort(d)} ${fromDateKey(d).getDate()}`} style={[styles.dayCol, styles.dayLink]}>
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
      <Legend />
    </>
  );
}

/* ------------------------------ I1 / I2 ------------------------------ */

function FavoritesView() {
  const nav = useRootNav();
  const { user } = useSession();
  const favs = useAsync(() => mealPlanningService.listFavorites(user?.id), [user?.id], { enabled: false });
  useFocusEffect(
    useCallback(() => {
      void favs.reload();
    }, [favs.reload]),
  );
  const list = favs.data ?? [];

  if (!favs.data && favs.loading) return <Skeleton width="100%" height={80} />;

  if (favs.error && list.length === 0) {
    return <Banner type="info" title="Favorit belum bisa dimuat" actionLabel="Coba lagi" onAction={favs.reload} />;
  }

  if (!list.length) {
    return (
      <View style={styles.empty}>
        <AppText variant="title2">Belum ada hidangan favorit</AppText>
        <AppText variant="subheadline" tone="secondary">Simpan hidangan untuk dipakai lagi di rencana atau catatan makan.</AppText>
        <ActionLink label="Buat favorit" onPress={() => nav.navigate('FavoriteEdit')} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.favHeader}>
        <AppText variant="footnoteEmphasized" tone="secondary" style={styles.flex}>
          {list.length} hidangan favorit
        </AppText>
        <ActionLink label="Buat favorit" onPress={() => nav.navigate('FavoriteEdit')} />
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
  flex: { flex: 1, minWidth: 0 },
  heading: { gap: spacing.xs },
  weekStrip: { flexDirection: 'row', gap: spacing.xxs },
  weekStripWrap: { flexWrap: 'wrap' },
  day: { minWidth: MIN_TOUCH, minHeight: 60, paddingVertical: spacing.s, borderRadius: radius.field,
    alignItems: 'center', justifyContent: 'center' },
  dayFluid: { flex: 1 },
  daySelected: { backgroundColor: colors.brandGreen },
  dayToday: { backgroundColor: colors.neutralGreenGray },
  dayNumber: { fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', gap: spacing.m, alignItems: 'center', flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  slotSection: { gap: spacing.s, paddingVertical: spacing.m, borderBottomWidth: 1, borderBottomColor: colors.labelQuaternary },
  slotHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  addBtn: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.field, backgroundColor: colors.neutralGreenGray,
    alignItems: 'center', justifyContent: 'center' },
  planRow: { backgroundColor: colors.neutralWhite, borderRadius: radius.surface, overflow: 'hidden' },
  entry: { minHeight: MIN_TOUCH, flexDirection: 'row', gap: spacing.m, padding: spacing.m, alignItems: 'flex-start' },
  entryConsumed: { backgroundColor: colors.neutralGreenGray },
  entryActions: { paddingLeft: 46, paddingRight: spacing.s, paddingBottom: spacing.xs,
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  pressed: { backgroundColor: colors.neutralYellowGray },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  navBtn: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  matrixRow: { flexDirection: 'row', alignItems: 'center' },
  matrixHeader: { paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.labelQuaternary },
  matrixDataRow: { paddingVertical: spacing.s, borderBottomWidth: 1, borderBottomColor: colors.labelQuaternary },
  todayRow: { backgroundColor: colors.neutralGreenGray, borderBottomColor: 'transparent' },
  dayCol: { width: 82 },
  cellCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cell: { minHeight: MIN_TOUCH },
  dayLink: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  empty: { gap: spacing.s, padding: spacing.l, backgroundColor: colors.neutralYellowGray, borderRadius: radius.verdict },
  favHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
});

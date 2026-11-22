import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
import {
  ActionLink,
  AppText,
  Banner,
  Button,
  Icon,
  IconButton,
  Meter,
  Screen,
  SectionHeader,
  Skeleton,
  StatusChip,
  outcomeChip,
  syncChip,
} from '../../shared/components';
import { NUTRIENT_LABEL, NUTRIENT_UNIT, SLOT_LABEL, SLOT_ORDER, UNIT_SPOKEN } from '../../shared/domain/nutrients';
import type { DailySummary, MealPlanEntry, MealSlot } from '../../shared/domain/types';
import { useConnectivity } from '../../shared/state/ConnectivityProvider';
import { useOfflineData } from '../../shared/sync/OfflineDataProvider';
import { MIN_TOUCH, colors, radius, spacing } from '../../shared/theme';
import { dayName, formatDayMonth, formatTime, todayKey } from '../../shared/utils/date';
import { formatNumber } from '../../shared/utils/format';
import { useDailySummary } from '../consumption-history/hooks';

export function HomeScreen() {
  const nav = useRootNav();
  const { online } = useConnectivity();
  const { plans, loaded, status: syncStatus } = useOfflineData();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.3;
  const today = todayKey();
  const { summary, incomplete, dayRecords } = useDailySummary(today);
  const todaysPlans = plans.filter((plan) => plan.date === today);
  const unsyncedRecords = dayRecords.filter((record) => record.syncStatus === 'LOCAL' || record.syncStatus === 'PENDING').length;
  const openLog = () => nav.navigate('LogSource', { date: today });

  const openCalendar = (addSlot?: MealSlot) =>
    nav.navigate('Main', {
      screen: 'PlanTab',
      params: { screen: 'PlanHome', params: { view: 'calendar', date: today, addSlot, nonce: addSlot ? Date.now() : undefined } },
    });

  return (
    <Screen inTabs gap={spacing.xl}>
      <View style={styles.intro}>
        <View style={styles.brandRow}>
          <AppText variant="subheadlineEmphasized" style={styles.wordmark}>AmbatuNourish</AppText>
          <IconButton
            icon={syncStatus === 'FAILED' || !online ? 'alert' : syncStatus === 'SYNCED' ? 'cloud-check' : 'refresh'}
            label={`Sinkronisasi, ${online ? syncChip[syncStatus] : 'offline'}`}
            color={syncStatus === 'FAILED' ? colors.stateError : colors.brandGreen}
            onPress={() => nav.navigate('SyncStatus')}
            style={styles.syncButton}
          />
        </View>
        <AppText variant="largeTitle" accessibilityRole="header">
          {dayName(today)}, {formatDayMonth(today)}
        </AppText>
      </View>

      {!online ? (
        <Banner type="offline" title="Anda sedang offline" message="Rencana dan catatan tetap bisa diubah di perangkat ini." />
      ) : null}

      <View style={[styles.quickActions, compact && styles.stack]}>
        <Button
          label="Pindai barcode"
          icon="scan"
          onPress={() => nav.navigate('CameraPermission')}
          style={compact ? undefined : styles.primaryAction}
        />
        <Button
          label="Cari produk"
          icon="search"
          type="secondary"
          onPress={() => nav.navigate('Main', { screen: 'ProductTab', params: { screen: 'ProductSearch' } })}
          style={compact ? undefined : styles.secondaryAction}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Asupan hari ini"
          actionLabel="Ringkasan"
          onAction={() => nav.navigate('Main', { screen: 'SummaryTab', params: { screen: 'SummaryHome', params: { view: 'summary', date: today } } })}
        />
        <View style={styles.intake}>
          {!loaded ? (
            <Skeleton width="100%" height={72} />
          ) : summary.recordCount === 0 ? (
            <View>
              <AppText variant="headline">Belum ada catatan hari ini</AppText>
              <AppText variant="subheadline" tone="secondary" style={styles.emptyHint}>Tambahkan makanan yang sudah Anda konsumsi.</AppText>
              <ActionLink label="Catat makan" onPress={openLog} />
            </View>
          ) : (
            <>
              <View style={[styles.figures, compact && styles.stack]}>
                <IntakeMetric metric="energy" summary={summary} />
                <View style={compact ? styles.horizontalDivider : styles.verticalDivider} />
                <IntakeMetric metric="protein" summary={summary} />
              </View>
              <View style={styles.intakeFooter}>
                <AppText variant="footnote" tone="secondary" style={styles.flex}>{summary.recordCount} catatan</AppText>
                <ActionLink label="Catat makan" onPress={openLog} />
              </View>
              {unsyncedRecords > 0 && !online ? (
                <AppText variant="footnote" tone="secondary">{unsyncedRecords} catatan tersimpan di perangkat</AppText>
              ) : null}
              {incomplete > 0 ? (
                <View style={styles.detailLine}>
                  <Icon name="info" size={16} color={colors.labelSecondary} />
                  <AppText variant="footnote" tone="secondary" style={styles.flex}>{incomplete} catatan dengan data gizi tidak lengkap</AppText>
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Rencana hari ini" actionLabel="Kalender" onAction={() => openCalendar()} />
        {SLOT_ORDER.map((slot) => (
          <SlotRow
            key={slot}
            slot={slot}
            entry={todaysPlans.find((plan) => plan.slot === slot)}
            online={online}
            onAdd={() => openCalendar(slot)}
            onOpen={(id) => nav.navigate('PlanDetail', { planId: id })}
            onMarkConsumed={(id) => nav.navigate('PlanDetail', { planId: id, markConsumed: true })}
          />
        ))}
      </View>
    </Screen>
  );
}

function IntakeMetric({ metric, summary }: { metric: 'energy' | 'protein'; summary: DailySummary }) {
  const unit = NUTRIENT_UNIT[metric];
  const value = summary.totals[metric];
  const known = summary.missingCount[metric] < summary.recordCount;
  const target = summary.targets[metric]?.value;
  const actualLabel = known ? `${formatNumber(value, 0)} ${UNIT_SPOKEN[unit]}` : 'Tidak tersedia';
  const targetLabel = known && target && target > 0 ? `, target ${formatNumber(target, 0)} ${UNIT_SPOKEN[unit]}` : '';

  return (
    <View style={styles.metric} accessible accessibilityLabel={`${NUTRIENT_LABEL[metric]}, ${actualLabel}${targetLabel}`}>
      <AppText variant="footnoteEmphasized" tone="secondary">{NUTRIENT_LABEL[metric]}</AppText>
      {known ? (
        <View style={styles.figuresValue}>
          <AppText variant="figure">{formatNumber(value, 0)}</AppText>
          <AppText variant="footnote" tone="secondary">{unit}</AppText>
        </View>
      ) : <AppText variant="subheadline" tone="secondary">Tidak tersedia</AppText>}
      {known && target && target > 0 ? (
        <>
          <Meter ratio={value / target} height={4} />
          <AppText variant="caption1" tone="secondary">Target {formatNumber(target, 0)} {unit}</AppText>
        </>
      ) : null}
    </View>
  );
}

function SlotRow({
  slot,
  entry,
  online,
  onAdd,
  onOpen,
  onMarkConsumed,
}: {
  slot: MealSlot;
  entry?: MealPlanEntry;
  online: boolean;
  onAdd: () => void;
  onOpen: (id: string) => void;
  onMarkConsumed: (id: string) => void;
}) {
  if (!entry) {
    return (
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={`Tambah rencana ${SLOT_LABEL[slot]}`}
        style={({ pressed }) => [styles.slot, styles.emptySlot, pressed && styles.pressed]}
      >
        <AppText variant="subheadlineEmphasized" style={styles.flex}>{SLOT_LABEL[slot]}</AppText>
        <Icon name="plus" size={20} color={colors.brandGreen} />
      </Pressable>
    );
  }
  const consumed = entry.status === 'CONSUMED';
  const status = consumed
    ? entry.consumedAt ? `Dikonsumsi ${formatTime(entry.consumedAt)}` : 'Dikonsumsi'
    : 'Direncanakan';
  const showSync = entry.syncStatus === 'FAILED' || (!online && entry.syncStatus !== 'SYNCED');

  return (
    <View style={styles.slot}>
      <Pressable
        onPress={() => onOpen(entry.id)}
        accessibilityRole="button"
        accessibilityLabel={`${SLOT_LABEL[slot]}, ${entry.title}, ${status}`}
        style={({ pressed }) => [styles.entry, pressed && styles.pressed]}
      >
        <Icon name={consumed ? 'consumed' : 'planned'} size={22} color={colors.brandGreen} />
        <View style={styles.slotText}>
          <AppText variant="footnote" tone="secondary">{SLOT_LABEL[slot]}</AppText>
          <AppText variant="headline">{entry.title}</AppText>
          <AppText variant="footnote" tone="secondary">{status}</AppText>
        </View>
        <Icon name="chev-right" size={18} color={colors.labelSecondary} />
      </Pressable>
      {showSync || !consumed ? (
        <View style={styles.entryActions}>
          {showSync ? <StatusChip status={syncChip[entry.syncStatus]} /> : entry.outcome ? (
            <StatusChip status={outcomeChip[entry.outcome]} />
          ) : null}
          {!consumed && !showSync ? (
            <ActionLink label="Tandai dikonsumsi" chevron={false} onPress={() => onMarkConsumed(entry.id)} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { paddingTop: spacing.xs, gap: spacing.s },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s },
  wordmark: { flexShrink: 1, letterSpacing: -0.3 },
  syncButton: { borderWidth: 1, borderColor: colors.borderStrong },
  quickActions: { flexDirection: 'row', gap: spacing.s },
  stack: { flexDirection: 'column' },
  primaryAction: { flex: 1.15 },
  secondaryAction: { flex: 1 },
  section: { gap: spacing.xs },
  intake: { backgroundColor: colors.neutralGreenGray, padding: spacing.l, borderRadius: radius.verdict, gap: spacing.s },
  emptyHint: { marginTop: spacing.xs },
  figures: { flexDirection: 'row', gap: spacing.m },
  metric: { flex: 1, minWidth: 0, gap: spacing.xs },
  figuresValue: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: spacing.xs },
  verticalDivider: { width: 1, backgroundColor: colors.labelQuaternary },
  horizontalDivider: { height: 1, backgroundColor: colors.labelQuaternary },
  intakeFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, flexWrap: 'wrap' },
  detailLine: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s },
  slot: { borderBottomWidth: 1, borderBottomColor: colors.labelQuaternary },
  emptySlot: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: spacing.s },
  entry: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: spacing.m },
  slotText: { flex: 1, minWidth: 0, gap: spacing.xxs },
  entryActions: { paddingLeft: 34, paddingBottom: spacing.xs, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.s },
  pressed: { backgroundColor: colors.neutralYellowGray },
});

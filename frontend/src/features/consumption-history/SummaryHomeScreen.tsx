import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
import {
  ActionLink,
  AppText,
  Button,
  Icon,
  IconButton,
  InfoNote,
  Meter,
  Screen,
  SectionHeader,
  Skeleton,
  StatusChip,
  SubNavigation,
  syncChip,
} from '../../shared/components';
import { NUTRIENT_LABEL, NUTRIENT_UNIT, SUMMARY_METRICS, UNIT_SPOKEN } from '../../shared/domain/nutrients';
import type { ConsumptionRecord, DailySummary, SummaryMetric } from '../../shared/domain/types';
import { useOfflineData } from '../../shared/sync/OfflineDataProvider';
import { MIN_TOUCH, colors, radius, spacing } from '../../shared/theme';
import { addDays, formatDayShortMonth, formatShortDay, formatTime, toDateKey, todayKey } from '../../shared/utils/date';
import { formatNumber } from '../../shared/utils/format';
import { useDailySummary } from './hooks';

type Params = { view?: 'summary' | 'history'; date?: string };

export function SummaryHomeScreen({ route }: { route: { params?: Params } }) {
  const [view, setView] = useState<'summary' | 'history'>(route.params?.view ?? 'summary');
  const [date, setDate] = useState(route.params?.date ?? todayKey());

  useEffect(() => {
    if (route.params?.view) setView(route.params.view);
    if (route.params?.date) setDate(route.params.date);
  }, [route.params?.view, route.params?.date]);

  return (
    <Screen inTabs gap={spacing.l}>
      <View style={styles.section}>
        <AppText variant="largeTitle" accessibilityRole="header">Ringkasan Gizi</AppText>
        <SubNavigation
          items={[
            { value: 'summary', label: 'Ringkasan' },
            { value: 'history', label: 'Riwayat' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>
      {view === 'summary' ? <DailySummaryView date={date} onDate={setDate} /> : <HistoryView />}
    </Screen>
  );
}

function DailySummaryView({ date, onDate }: { date: string; onDate: (date: string) => void }) {
  const nav = useRootNav();
  const { loaded } = useOfflineData();
  const { summary, incomplete } = useDailySummary(date);
  const isToday = date === todayKey();
  const hasTargets = SUMMARY_METRICS.some((metric) => (summary.targets[metric]?.value ?? 0) > 0);

  return (
    <>
      <View style={styles.dateSelector}>
        <IconButton icon="back" size={19} label="Hari sebelumnya" onPress={() => onDate(addDays(date, -1))} style={styles.dateButton} />
        <View style={styles.dateCenter} accessibilityLiveRegion="polite">
          <AppText variant="headline" align="center">{formatDayShortMonth(date)}</AppText>
          {isToday ? <AppText variant="caption1" tone="secondary">Hari ini</AppText> : null}
        </View>
        <Pressable
          onPress={() => onDate(addDays(date, 1))}
          disabled={isToday}
          accessibilityRole="button"
          accessibilityLabel="Hari berikutnya"
          accessibilityState={{ disabled: isToday }}
          style={({ pressed }) => [styles.dateButton, styles.nextDay, pressed && styles.pressed, isToday && styles.disabled]}
        >
          <Icon name="chev-right" size={19} />
        </Pressable>
      </View>

      {!loaded ? (
        <Skeleton width="100%" height={120} />
      ) : summary.recordCount === 0 ? (
        <View style={styles.emptyDay}>
          <AppText variant="title2">Belum ada catatan</AppText>
          <AppText variant="subheadline" tone="secondary">Tambahkan makanan yang Anda konsumsi pada tanggal ini.</AppText>
          <ActionLink label="Catat makan" onPress={() => nav.navigate('LogSource', { date })} />
        </View>
      ) : (
        <>
          <View style={styles.energy}>
            <AppText variant="footnoteEmphasized" tone="secondary">Asupan dari {summary.recordCount} catatan</AppText>
            <MetricSummary metric="energy" summary={summary} featured />
          </View>
          {incomplete > 0 ? (
            <InfoNote icon="info" tone="yellow">
              {incomplete} catatan memiliki data gizi yang belum lengkap.
            </InfoNote>
          ) : null}
          <View>
            <SectionHeader title="Rincian gizi" />
            {SUMMARY_METRICS.filter((metric) => metric !== 'energy').map((metric) => (
              <MetricSummary key={metric} metric={metric} summary={summary} />
            ))}
          </View>
          {!hasTargets ? (
            <View style={styles.targetNote}>
              <AppText variant="footnote" tone="secondary">Target harian belum tersedia.</AppText>
              <ActionLink
                label="Lihat Profil Preferensi"
                onPress={() => nav.navigate('Main', { screen: 'ProfileTab', params: { screen: 'Preferences' } })}
              />
            </View>
          ) : null}
        </>
      )}
    </>
  );
}

function MetricSummary({ metric, summary, featured = false }: { metric: SummaryMetric; summary: DailySummary; featured?: boolean }) {
  const label = NUTRIENT_LABEL[metric];
  const unit = NUTRIENT_UNIT[metric];
  const value = summary.totals[metric];
  const missing = summary.missingCount[metric];
  const target = summary.targets[metric];
  const known = missing < summary.recordCount;
  const hasTarget = target !== undefined && target.value > 0;
  const targetSource = target?.source === 'NUTRITION_PLAN' ? 'Nutrition Plan' : 'target Anda';
  const valueLabel = known ? `${formatNumber(value, 0)} ${UNIT_SPOKEN[unit]}` : 'Tidak tersedia';
  const targetLabel = hasTarget ? `, target ${formatNumber(target.value, 0)} ${UNIT_SPOKEN[unit]} dari ${targetSource}` : '';
  const missingLabel = known && missing ? `, ${missing} catatan tanpa nilai` : '';

  return (
    <View
      style={featured ? styles.featuredMetric : styles.metric}
      accessible accessibilityLabel={`${label}, ${valueLabel}${targetLabel}${missingLabel}`}
    >
      <View style={[styles.metricRow, featured && styles.featuredRow]}>
        <AppText variant={featured ? 'headline' : 'subheadlineEmphasized'} style={!featured && styles.metricLabel}>{label}</AppText>
        {known ? (
          <View style={styles.metricValue}>
            <AppText variant={featured ? 'figure' : 'headline'} style={styles.numeral}>{formatNumber(value, 0)}</AppText>
            <AppText variant="footnote" tone="secondary">{unit}</AppText>
          </View>
        ) : <AppText variant="footnote" tone="secondary">Tidak tersedia</AppText>}
      </View>
      {hasTarget ? (
        <>
          {known ? <Meter ratio={value / target.value} height={5} /> : null}
          <AppText variant="caption1" tone="secondary">Target {formatNumber(target.value, 0)} {unit} dari {targetSource}</AppText>
        </>
      ) : null}
      {known && missing > 0 ? <AppText variant="caption1" tone="secondary">{missing} catatan tanpa nilai</AppText> : null}
    </View>
  );
}

function HistoryView() {
  const nav = useRootNav();
  const { records, queue, retry, loaded } = useOfflineData();
  const groups = useMemo(() => {
    const map = new Map<string, ConsumptionRecord[]>();
    [...records].sort((a, b) => b.consumedAt.localeCompare(a.consumedAt)).forEach((record) => {
      const day = toDateKey(new Date(record.consumedAt));
      map.set(day, [...(map.get(day) ?? []), record]);
    });
    return [...map.entries()];
  }, [records]);

  return (
    <>
      <View style={styles.historyHeader}>
        <AppText variant="footnote" tone="secondary" style={styles.flex}>{records.length} catatan</AppText>
        <Button label="Catat makan" type="secondary" icon="plus" fullWidth={false} onPress={() => nav.navigate('LogSource')} />
      </View>
      {!loaded ? <Skeleton width="100%" height={72} /> : null}
      {loaded && groups.length === 0 ? <InfoNote>Belum ada catatan konsumsi.</InfoNote> : null}
      {groups.map(([day, list]) => (
        <View key={day}>
          <SectionHeader title={day === todayKey() ? `Hari ini, ${formatShortDay(day)}` : formatDayShortMonth(day)} variant="headline" />
          {list.map((record) => {
            const failedOp = queue.find((operation) => operation.entityId === record.id && operation.status === 'FAILED');
            const incomplete = SUMMARY_METRICS.some((metric) => record.snapshot[metric] === null);
            const kcal = record.snapshot.energy;
            const detail = record.source === 'PLAN'
              ? `${record.itemsCount} item dari rencana`
              : record.source === 'FAVORITE' ? 'Favorit' : `${formatNumber(record.quantity)} ${record.unit}`;
            return (
              <View key={record.id} style={styles.logItem}>
                <Pressable
                  onPress={() => nav.navigate('LogForm', { source: record.source, recordId: record.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatTime(record.consumedAt)}, ${record.title}, ${detail}${kcal === null ? '' : `, ${formatNumber(kcal, 0)} kilokalori`}`}
                  style={({ pressed }) => [styles.logRow, pressed && styles.pressed]}
                >
                  <AppText variant="footnoteEmphasized" tone="secondary" style={[styles.numeral, styles.timeCol]}>
                    {formatTime(record.consumedAt)}
                  </AppText>
                  <View style={styles.flex}>
                    <AppText variant="subheadlineEmphasized">{record.title}</AppText>
                    <AppText variant="footnote" tone="secondary">{detail}{kcal === null ? '' : ` · ${formatNumber(kcal, 0)} kkal`}</AppText>
                  </View>
                  <Icon name="chev-right" size={18} color={colors.labelSecondary} />
                </Pressable>
                {record.syncStatus !== 'SYNCED' || incomplete ? (
                  <View style={styles.logStatus}>
                    <StatusChip status={record.syncStatus === 'SYNCED' ? 'Data tidak lengkap' : syncChip[record.syncStatus]} />
                    {failedOp ? <ActionLink label="Coba lagi" chevron={false} onPress={() => void retry(failedOp.opId)} /> : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  section: { gap: spacing.xs },
  dateSelector: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  dateButton: { backgroundColor: colors.neutralWhite, borderWidth: 1, borderColor: colors.borderStrong },
  nextDay: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.field, alignItems: 'center', justifyContent: 'center' },
  dateCenter: { flex: 1, alignItems: 'center', gap: spacing.xxs },
  pressed: { backgroundColor: colors.neutralYellowGray },
  disabled: { opacity: 0.45 },
  energy: { padding: spacing.l, borderRadius: radius.verdict, backgroundColor: colors.neutralGreenGray, gap: spacing.s },
  emptyDay: { padding: spacing.l, borderRadius: radius.verdict, backgroundColor: colors.neutralYellowGray, gap: spacing.xs },
  featuredMetric: { gap: spacing.xs },
  metric: { paddingVertical: spacing.m, gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.labelQuaternary },
  metricRow: { flexDirection: 'row', alignItems: 'baseline', columnGap: spacing.s, flexWrap: 'wrap' },
  featuredRow: { justifyContent: 'space-between' },
  metricLabel: { flexGrow: 1 },
  metricValue: { flexDirection: 'row', alignItems: 'baseline', columnGap: spacing.xs, flexWrap: 'wrap' },
  numeral: { fontVariant: ['tabular-nums'] },
  targetNote: { paddingTop: spacing.xs },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, flexWrap: 'wrap' },
  logItem: { borderBottomWidth: 1, borderBottomColor: colors.labelQuaternary },
  logRow: { minHeight: MIN_TOUCH, flexDirection: 'row', gap: spacing.m, paddingVertical: spacing.m, alignItems: 'flex-start' },
  timeCol: { minWidth: 44 },
  logStatus: { paddingLeft: 56, paddingBottom: spacing.s, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.s },
});

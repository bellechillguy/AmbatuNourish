/**
 * Tab Ringkasan: Ringkasan (L1 harian, L2 tanpa target, L3 hari tanpa catatan) dan Riwayat (K3).
 * Dihitung HANYA dari Catatan Konsumsi; rencana yang belum dimakan tidak dihitung.
 * Bar netral (hitam di atas Green Gray), tanpa penilaian merah/hijau atau alarm "melebihi batas".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
import {
  AppText,
  Button,
  Icon,
  InfoNote,
  Meter,
  Screen,
  SectionHeader,
  StatusChip,
  SubNavigation,
  syncChip,
} from '../../shared/components';
import { NUTRIENT_LABEL, SUMMARY_METRICS } from '../../shared/domain/nutrients';
import type { ConsumptionRecord, SummaryMetric } from '../../shared/domain/types';
import { useOfflineData } from '../../shared/sync/OfflineDataProvider';
import { colors, radius, spacing } from '../../shared/theme';
import { addDays, formatDayShortMonth, formatShortDay, formatTime, toDateKey, todayKey } from '../../shared/utils/date';
import { formatNumber } from '../../shared/utils/format';
import { useDailySummary } from './hooks';

const UNIT: Record<SummaryMetric, string> = { energy: 'kkal', protein: 'g', carbohydrate: 'g', sugar: 'g', fat: 'g', sodium: 'mg' };
const SPOKEN: Record<string, string> = { kkal: 'kilokalori', g: 'gram', mg: 'miligram' };

type Params = { view?: 'summary' | 'history'; date?: string };

export function SummaryHomeScreen({ route }: { route: { params?: Params } }) {
  const [view, setView] = useState<'summary' | 'history'>(route.params?.view ?? 'summary');
  const [date, setDate] = useState(route.params?.date ?? todayKey());

  useEffect(() => {
    if (route.params?.view) setView(route.params.view);
    if (route.params?.date) setDate(route.params.date);
  }, [route.params?.view, route.params?.date]);

  return (
    <Screen inTabs gap={spacing.s}>
      <AppText variant="largeTitle" accessibilityRole="header">
        Ringkasan Gizi
      </AppText>
      <SubNavigation
        items={[
          { value: 'summary', label: 'Ringkasan' },
          { value: 'history', label: 'Riwayat' },
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'summary' ? <DailySummaryView date={date} onDate={setDate} /> : <HistoryView />}
    </Screen>
  );
}

/* ------------------------------ L1 / L2 / L3 ------------------------------ */

function DailySummaryView({ date, onDate }: { date: string; onDate: (d: string) => void }) {
  const nav = useRootNav();
  const { summary, incomplete } = useDailySummary(date);
  const today = todayKey();
  const isToday = date === today;
  const hasTargets = Object.keys(summary.targets).length > 0;
  const firstWithBar = SUMMARY_METRICS.find((m) => summary.targets[m]);
  const sodiumMissing = summary.missingCount.sodium;

  return (
    <>
      <View style={styles.dateSelector}>
        <Pressable onPress={() => onDate(addDays(date, -1))} accessibilityRole="button" accessibilityLabel="Hari sebelumnya" style={styles.dateBtn}>
          <Icon name="back" size={20} />
        </Pressable>
        <View style={styles.dateCenter} accessibilityLiveRegion="polite">
          <AppText variant="headline" align="center">
            {formatDayShortMonth(date)}
          </AppText>
          <AppText variant="caption1" tone="secondary">
            {isToday ? 'Hari ini' : ' '}
          </AppText>
        </View>
        <Pressable
          onPress={() => !isToday && onDate(addDays(date, 1))}
          disabled={isToday}
          accessibilityRole="button"
          accessibilityLabel="Hari berikutnya"
          accessibilityState={{ disabled: isToday }}
          style={[styles.dateBtn, isToday && { opacity: 0.35 }]}
        >
          <Icon name="chev-right" size={20} />
        </Pressable>
      </View>

      {summary.recordCount === 0 ? (
        <View style={styles.emptyDay}>
          <AppText variant="title2">Tidak ada Catatan Konsumsi pada hari ini</AppText>
          <AppText variant="subheadline" tone="secondary">
            Jika Anda lupa mencatat, catatan bisa ditambahkan untuk tanggal ini.
          </AppText>
          <Button label={`Catat untuk ${formatShortDay(date).split(', ')[1]}`} icon="plus" type="secondary" onPress={() => nav.navigate('LogSource', { date })} />
        </View>
      ) : (
        <>
          {!hasTargets ? (
            <View style={[styles.notice, { backgroundColor: colors.neutralGreenGray }]}>
              <Icon name="info" size={20} />
              <View style={[styles.flex, { gap: 6 }]}>
                <AppText variant="subheadlineEmphasized">Belum ada target harian</AppText>
                <AppText variant="footnote">
                  Angka di bawah adalah total asupan Anda. Indikator kemajuan muncul bila ada target dari Nutrition Plan atau target
                  yang Anda atur.
                </AppText>
                <Pressable
                  onPress={() => nav.navigate('Main', { screen: 'ProfileTab', params: { screen: 'Preferences' } })}
                  accessibilityRole="link"
                  hitSlop={10}
                >
                  <AppText variant="footnoteEmphasized">Lihat Profil Preferensi</AppText>
                </Pressable>
              </View>
            </View>
          ) : null}

          {incomplete > 0 ? (
            <View style={[styles.notice, { backgroundColor: colors.brandYellow }]} accessibilityRole="alert">
              <Icon name="alert" size={20} />
              <View style={styles.flex}>
                <AppText variant="subheadlineEmphasized">Total belum lengkap</AppText>
                <AppText variant="footnote">
                  {sodiumMissing > 0
                    ? `${sodiumMissing} dari ${summary.recordCount} catatan tidak punya nilai natrium, jadi total natrium belum mencakupnya.`
                    : `${incomplete} dari ${summary.recordCount} catatan tidak punya sebagian nilai gizi, jadi totalnya belum mencakup nilai tersebut.`}
                </AppText>
              </View>
            </View>
          ) : null}

          {SUMMARY_METRICS.map((m) => {
            const target = summary.targets[m];
            const value = summary.totals[m];
            const missing = summary.missingCount[m];
            const allMissing = missing === summary.recordCount;
            const a11y = `${NUTRIENT_LABEL[m]}, ${allMissing ? 'tidak tersedia' : `${formatNumber(value, 0)}${target ? ` dari ${formatNumber(target.value, 0)}` : ''} ${SPOKEN[UNIT[m]]}`}${
              target && m === firstWithBar ? `, target dari ${target.source === 'NUTRITION_PLAN' ? 'Nutrition Plan' : 'target Anda'}` : ''
            }${missing > 0 && !allMissing ? `, ${missing} catatan tidak tersedia` : ''}`;
            return (
              <View key={m} style={styles.metric} accessible accessibilityLabel={a11y}>
                <View style={styles.metricRow}>
                  <AppText variant="body" style={styles.flex}>
                    {NUTRIENT_LABEL[m]}
                  </AppText>
                  {allMissing ? (
                    <AppText variant="footnoteItalic" tone="secondary">
                      Tidak tersedia
                    </AppText>
                  ) : (
                    <>
                      <AppText variant="title2">{formatNumber(value, 0)}</AppText>
                      <AppText variant="subheadline" tone="secondary">
                        {target ? `${UNIT[m]} / ${formatNumber(target.value, 0)} ${UNIT[m]}` : UNIT[m]}
                      </AppText>
                    </>
                  )}
                </View>
                {target && !allMissing ? <Meter ratio={value / target.value} height={8} /> : null}
                {target && m === firstWithBar ? (
                  <AppText variant="caption1" tone="secondary">
                    Target dari {target.source === 'NUTRITION_PLAN' ? 'Nutrition Plan' : 'target Anda'}
                  </AppText>
                ) : null}
                {missing > 0 && !allMissing ? (
                  <View style={styles.missing}>
                    <Icon name="alert" size={14} />
                    <AppText variant="caption1Emphasized">{missing} catatan tidak tersedia</AppText>
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      )}
    </>
  );
}

/* ------------------------------ K3 ------------------------------ */

function HistoryView() {
  const nav = useRootNav();
  const { records, queue, retry } = useOfflineData();
  const groups = useMemo(() => {
    const sorted = [...records].sort((a, b) => b.consumedAt.localeCompare(a.consumedAt));
    const map = new Map<string, ConsumptionRecord[]>();
    sorted.forEach((r) => {
      const k = toDateKey(new Date(r.consumedAt));
      map.set(k, [...(map.get(k) ?? []), r]);
    });
    return [...map.entries()];
  }, [records]);

  return (
    <>
      <View style={styles.historyHeader}>
        <View style={styles.flex} />
        <Pressable onPress={() => nav.navigate('LogSource')} accessibilityRole="button" style={styles.addLink} hitSlop={8}>
          <Icon name="plus" size={18} />
          <AppText variant="subheadlineEmphasized">Catat makan</AppText>
        </Pressable>
      </View>
      {groups.length === 0 ? (
        <InfoNote>Belum ada Catatan Konsumsi. Catatan yang Anda simpan akan muncul di sini, dikelompokkan per hari.</InfoNote>
      ) : null}
      {groups.map(([day, list]) => (
        <View key={day}>
          <SectionHeader title={day === todayKey() ? `Hari ini, ${formatShortDay(day)}` : formatDayShortMonth(day)} variant="headline" />
          {list.map((r) => {
            const failedOp = queue.find((o) => o.entityId === r.id && o.status === 'FAILED');
            const incomplete = SUMMARY_METRICS.some((m) => r.snapshot[m] === null);
            const kcal = r.snapshot.energy;
            const detail =
              r.source === 'PLAN'
                ? `dari rencana, ${r.itemsCount} item`
                : r.source === 'FAVORITE'
                  ? 'favorit'
                  : `${formatNumber(r.quantity)} ${r.unit}`;
            return (
              <Pressable
                key={r.id}
                onPress={() => nav.navigate('LogForm', { source: r.source, recordId: r.id })}
                accessibilityRole="button"
                accessibilityLabel={`${formatTime(r.consumedAt)}, ${r.title}, ${detail}`}
                style={styles.logRow}
              >
                <View style={styles.timeCol}>
                  <AppText variant="subheadlineEmphasized">{formatTime(r.consumedAt)}</AppText>
                </View>
                <View style={[styles.flex, { gap: spacing.xs }]}>
                  <AppText variant="subheadlineEmphasized">{r.title}</AppText>
                  <AppText variant="footnote" tone="secondary">
                    {detail}
                    {kcal !== null ? ` (${formatNumber(kcal, 0)} kkal)` : ''}
                  </AppText>
                  {/* Status sinkron hanya tampil bila perlu perhatian; tersinkron = diam. */}
                  {r.syncStatus !== 'SYNCED' || incomplete ? (
                    <View style={styles.wrap}>
                      {r.syncStatus !== 'SYNCED' ? <StatusChip status={syncChip[r.syncStatus]} /> : null}
                      {r.syncStatus === 'FAILED' ? (
                        <Pressable onPress={() => void retry(failedOp?.opId)} accessibilityRole="button" hitSlop={10}>
                          <AppText variant="footnoteEmphasized">Coba lagi</AppText>
                        </Pressable>
                      ) : null}
                      {incomplete && r.syncStatus === 'SYNCED' ? <StatusChip status="Data tidak lengkap" /> : null}
                    </View>
                  ) : null}
                </View>
                <Icon name="chev-right" size={20} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: spacing.xs },
  dateBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.labelQuaternary, alignItems: 'center', justifyContent: 'center' },
  dateCenter: { flex: 1, alignItems: 'center' },
  notice: { flexDirection: 'row', gap: 10, padding: spacing.m, borderRadius: radius.surface },
  metric: { paddingVertical: spacing.m, gap: 6, borderBottomWidth: 1, borderBottomColor: colors.labelQuaternary },
  metricRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.s, flexWrap: 'wrap' },
  missing: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  emptyDay: { gap: 10, paddingTop: spacing.xl },
  historyHeader: { flexDirection: 'row', alignItems: 'center' },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  logRow: {
    flexDirection: 'row',
    gap: spacing.m,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
    alignItems: 'flex-start',
  },
  timeCol: { width: 48 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, alignItems: 'center' },
});

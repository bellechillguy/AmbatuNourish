/**
 * 02. Beranda — B1 (terisi), B2 (hari pertama / kosong), B3 (offline, menunggu sinkronisasi).
 * Blok asupan = Catatan Konsumsi saja (tidak pernah rencana). Meter hanya bila ada target.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
import {
  AppText,
  Banner,
  Button,
  Icon,
  Meter,
  Screen,
  SectionHeader,
  StatusChip,
  outcomeChip,
  syncChip,
} from '../../shared/components';
import { NUTRIENT_LABEL, SLOT_LABEL, SLOT_ORDER } from '../../shared/domain/nutrients';
import type { MealPlanEntry, MealSlot, SummaryMetric } from '../../shared/domain/types';
import { useConnectivity } from '../../shared/state/ConnectivityProvider';
import { useOfflineData } from '../../shared/sync/OfflineDataProvider';
import { colors, radius, spacing } from '../../shared/theme';
import { dayName, formatDayMonth, formatTime, todayKey } from '../../shared/utils/date';
import { formatNumber } from '../../shared/utils/format';
import { useDailySummary } from '../consumption-history/hooks';

const HOME_METRICS: SummaryMetric[] = ['energy', 'protein'];
const UNIT: Record<SummaryMetric, string> = { energy: 'kkal', protein: 'g', carbohydrate: 'g', sugar: 'g', fat: 'g', sodium: 'mg' };

export function HomeScreen() {
  const nav = useRootNav();
  const { online } = useConnectivity();
  const { plans, status: syncStatus } = useOfflineData();
  const today = todayKey();
  const { summary, incomplete, dayRecords } = useDailySummary(today);
  const todaysPlans = plans.filter((p) => p.date === today);
  const firstDay = dayRecords.length === 0 && todaysPlans.length === 0;
  const unsyncedRecords = dayRecords.filter((r) => r.syncStatus === 'LOCAL' || r.syncStatus === 'PENDING').length;
  const missingNatrium = summary.missingCount.sodium;

  const openScanner = () => nav.navigate('CameraPermission');
  const openSearch = () => nav.navigate('Main', { screen: 'ProductTab', params: { screen: 'ProductSearch' } });
  const openSummary = () => nav.navigate('Main', { screen: 'SummaryTab', params: { screen: 'SummaryHome', params: { view: 'summary' } } });
  const openCalendar = (addSlot?: MealSlot) =>
    nav.navigate('Main', { screen: 'PlanTab', params: { screen: 'PlanHome', params: { view: 'calendar', date: today, addSlot, nonce: addSlot ? Date.now() : undefined } } });

  const headerChip = syncChip[syncStatus];

  return (
    <Screen inTabs gap={spacing.m}>
      {/* Header: tanggal + chip sinkronisasi global (→ O1) */}
      <View style={[styles.header, !online && styles.headerStacked]}>
        {!online ? (
          <Pressable onPress={() => nav.navigate('SyncStatus')} accessibilityRole="button" accessibilityHint="Buka status sinkronisasi">
            <StatusChip status={headerChip} />
          </Pressable>
        ) : null}
        <View style={styles.flex}>
          <AppText variant="footnoteEmphasized" tone="secondary">
            {dayName(today)}
          </AppText>
          <AppText variant="largeTitle" accessibilityRole="header">
            {formatDayMonth(today)}
          </AppText>
        </View>
        {online && !firstDay ? (
          <Pressable onPress={() => nav.navigate('SyncStatus')} accessibilityRole="button" accessibilityHint="Buka status sinkronisasi">
            <StatusChip status={headerChip} />
          </Pressable>
        ) : null}
      </View>

      {!online ? (
        <Banner
          type="offline"
          title="Anda sedang offline"
          message="Rencana dan catatan tetap bisa diubah. Pemindaian dan pencarian produk butuh koneksi, kecuali yang sudah tersimpan."
        />
      ) : null}

      <View style={styles.quickActions}>
        <Button label="Pindai barcode" icon="scan" onPress={openScanner} style={styles.flex} />
        <Button label="Cari" icon="search" type="secondary" onPress={openSearch} fullWidth={false} />
      </View>

      {!firstDay ? (
        <Pressable onPress={() => nav.navigate('LogSource')} accessibilityRole="link" style={styles.logLink} hitSlop={8}>
          <Icon name="plus" size={18} />
          <AppText variant="subheadlineEmphasized">Catat makan tanpa memindai</AppText>
        </Pressable>
      ) : null}

      {/* ---------- Asupan hari ini ---------- */}
      <SectionHeader title="Asupan hari ini" actionLabel={firstDay ? undefined : 'Ringkasan'} onAction={openSummary} />
      {firstDay || dayRecords.length === 0 ? (
        <View style={styles.emptyIntake}>
          <AppText variant="headline">Belum ada Catatan Konsumsi hari ini.</AppText>
          <AppText variant="subheadline" tone="secondary">
            Pindai kemasan atau pilih makanan favorit, lalu catat porsinya. Ringkasan dihitung dari yang benar-benar Anda
            makan.
          </AppText>
          <Button label="Catat makan pertama" icon="plus" type="secondary" onPress={() => nav.navigate('LogSource')} />
        </View>
      ) : (
        <>
          {HOME_METRICS.map((m) => {
            const target = summary.targets[m];
            const value = summary.totals[m];
            const a11y = target
              ? `${NUTRIENT_LABEL[m]}, ${formatNumber(value, 0)} dari ${formatNumber(target.value, 0)} ${m === 'energy' ? 'kilokalori' : 'gram'}`
              : `${NUTRIENT_LABEL[m]}, ${formatNumber(value, 0)} ${m === 'energy' ? 'kilokalori' : 'gram'}`;
            return (
              <View key={m} style={styles.meter} accessible accessibilityLabel={a11y}>
                <View style={styles.meterRow}>
                  <AppText variant="subheadline" style={styles.flex}>
                    {NUTRIENT_LABEL[m]}
                  </AppText>
                  <AppText variant="subheadlineEmphasized">{formatNumber(value, 0)}</AppText>
                  <AppText variant="subheadline" tone="secondary">
                    {target ? `/ ${formatNumber(target.value, 0)} ${UNIT[m]}` : UNIT[m]}
                  </AppText>
                </View>
                {target ? <Meter ratio={value / target.value} /> : null}
              </View>
            );
          })}
          {!online && unsyncedRecords > 0 ? (
            <View style={styles.wrapRow}>
              <StatusChip status="Tersimpan di perangkat" />
              <AppText variant="footnote" tone="secondary">
                Termasuk {unsyncedRecords} catatan baru
              </AppText>
            </View>
          ) : incomplete > 0 ? (
            <View style={styles.wrapRow}>
              <StatusChip status="Data tidak lengkap" />
              <AppText variant="footnote" tone="secondary">
                {missingNatrium > 0
                  ? `${missingNatrium} dari ${summary.recordCount} catatan tanpa nilai natrium`
                  : `${incomplete} dari ${summary.recordCount} catatan tanpa sebagian nilai gizi`}
              </AppText>
            </View>
          ) : null}
        </>
      )}

      {/* ---------- Rencana hari ini ---------- */}
      <SectionHeader title="Rencana hari ini" actionLabel={firstDay ? undefined : 'Kalender'} onAction={() => openCalendar()} />
      {SLOT_ORDER.map((slot) => {
        const entry = todaysPlans.find((p) => p.slot === slot);
        if (firstDay) {
          return (
            <Pressable
              key={slot}
              onPress={() => openCalendar(slot)}
              accessibilityRole="button"
              accessibilityLabel={`${SLOT_LABEL[slot]}, tambah rencana`}
              style={styles.emptySlotRow}
            >
              <AppText variant="body" tone="secondary">
                {SLOT_LABEL[slot]}
              </AppText>
              <Icon name="plus" size={24} />
            </Pressable>
          );
        }
        return (
          <SlotRow
            key={slot}
            slot={slot}
            entry={entry}
            online={online}
            onAdd={() => openCalendar(slot)}
            onOpen={(id) => nav.navigate('PlanDetail', { planId: id })}
            onMarkConsumed={(id) => nav.navigate('PlanDetail', { planId: id, markConsumed: true })}
          />
        );
      })}
    </Screen>
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
      <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel={`${SLOT_LABEL[slot]}, belum ada rencana. Tambah`} style={styles.slot}>
        <Icon name="plus" size={24} />
        <View style={styles.slotText}>
          <AppText variant="footnoteEmphasized" tone="secondary">
            {SLOT_LABEL[slot]}
          </AppText>
          <AppText variant="body" tone="secondary">
            Belum ada rencana
          </AppText>
        </View>
      </Pressable>
    );
  }
  const consumed = entry.status === 'CONSUMED';
  const needsAttention = entry.syncStatus !== 'SYNCED';
  return (
    <Pressable
      onPress={() => onOpen(entry.id)}
      accessibilityRole="button"
      accessibilityLabel={`${SLOT_LABEL[slot]}, ${entry.title}, ${consumed ? `dikonsumsi ${entry.consumedAt ? formatTime(entry.consumedAt) : ''}` : 'direncanakan'}`}
      style={styles.slot}
    >
      <Icon name={consumed ? 'consumed' : 'planned'} size={24} />
      <View style={styles.slotText}>
        <AppText variant="footnoteEmphasized" tone="secondary">
          {SLOT_LABEL[slot]}
        </AppText>
        <AppText variant="headline">{entry.title}</AppText>
        <AppText variant="footnote" tone="secondary">
          {consumed ? `Dikonsumsi ${entry.consumedAt ? formatTime(entry.consumedAt) : ''}` : 'Direncanakan'}
        </AppText>
        {needsAttention && (!online || entry.syncStatus === 'FAILED') ? (
          <StatusChip status={syncChip[entry.syncStatus]} style={{ marginTop: spacing.xs }} />
        ) : !consumed ? (
          <View style={[styles.wrapRow, { marginTop: spacing.xs }]}>
            {entry.outcome ? <StatusChip status={outcomeChip[entry.outcome]} /> : null}
            <Pressable onPress={() => onMarkConsumed(entry.id)} accessibilityRole="button" hitSlop={10}>
              <AppText variant="footnoteEmphasized">Tandai dikonsumsi</AppText>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', gap: spacing.s, paddingTop: spacing.s, alignItems: 'flex-start' },
  headerStacked: { flexDirection: 'column' },
  quickActions: { flexDirection: 'row', gap: spacing.s, alignItems: 'center' },
  logLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2, paddingBottom: 4, alignSelf: 'flex-start' },
  meter: { paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: colors.labelQuaternary },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.s },
  emptyIntake: { backgroundColor: colors.neutralYellowGray, borderRadius: radius.surface, padding: spacing.l, gap: spacing.s },
  emptySlotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
    minHeight: 48,
  },
  slot: {
    flexDirection: 'row',
    gap: spacing.m,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
    alignItems: 'flex-start',
  },
  slotText: { flex: 1, gap: 2 },
});

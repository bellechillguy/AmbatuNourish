/**
 * 15. Sinkronisasi & Offline — O1 status/antrean, O2 perbedaan versi (sheet), O3 semua tersinkron.
 * Hanya Rencana Makan & Catatan Konsumsi yang dapat diubah offline (FR-OFF).
 * Tidak ada data yang dibuang tanpa pilihan pengguna.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
import {
  ActionBar,
  AppText,
  Banner,
  BottomSheet,
  Button,
  Icon,
  RadioDot,
  Screen,
  StatusChip,
  TopAppBar,
} from '../../shared/components';
import { SLOT_LABEL } from '../../shared/domain/nutrients';
import type { ConsumptionRecord, MealPlanEntry } from '../../shared/domain/types';
import { useConnectivity } from '../../shared/state/ConnectivityProvider';
import type { ConflictItem } from '../../shared/sync/queue';
import { useOfflineData } from '../../shared/sync/OfflineDataProvider';
import { colors, radius, spacing } from '../../shared/theme';
import { formatShortDay, formatTime, relativeDayLabel, toDateKey } from '../../shared/utils/date';
import type { QueuedOperation } from '../../services/sync';

function lastSyncedLabel(iso: string | null) {
  if (!iso) return 'belum pernah';
  return `${relativeDayLabel(toDateKey(new Date(iso))).toLowerCase()}, ${formatTime(iso)}`;
}

function opTitle(op: QueuedOperation, plans: MealPlanEntry[], records: ConsumptionRecord[]) {
  if (op.entityType === 'MEAL_PLAN') {
    const p = (op.payload as MealPlanEntry | null) ?? plans.find((x) => x.id === op.entityId);
    return { icon: 'calendar' as const, title: `Rencana Makan, ${p ? formatShortDay(p.date) : ''}`, name: p?.title };
  }
  const r = (op.payload as ConsumptionRecord | null) ?? records.find((x) => x.id === op.entityId);
  return { icon: 'list' as const, title: `Catatan Konsumsi, ${r?.title ?? ''}`, name: r?.title };
}

const VERB: Record<QueuedOperation['op'], string> = { CREATE: 'Dibuat', UPDATE: 'Diubah', DELETE: 'Dihapus' };

export function SyncStatusScreen() {
  const nav = useRootNav();
  const { online } = useConnectivity();
  const { queue, conflicts, plans, records, syncing, syncNow, retry, lastSyncedAt, resolveConflict } = useOfflineData();
  const [conflictFor, setConflictFor] = useState<ConflictItem | null>(null);
  const failed = queue.filter((o) => o.status === 'FAILED').length;
  const allSynced = queue.length === 0 && conflicts.length === 0;
  const header = <TopAppBar onLeading={() => nav.goBack()} title="Status sinkronisasi" />;

  if (allSynced) {
    return (
      <Screen gap={10} gradientHeader={header}>
        <View style={styles.done}>
          <View style={styles.doneMark}>
            <Icon name="cloud-check" size={28} />
          </View>
          <AppText variant="title2">Semua perubahan sudah tersinkron</AppText>
          <AppText variant="subheadline" tone="secondary">
            Rencana Makan dan Catatan Konsumsi di perangkat ini sama dengan yang tersimpan di akun Anda. Terakhir:{' '}
            {lastSyncedLabel(lastSyncedAt)}.
          </AppText>
          <StatusChip status="Tersinkron" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      gap={10}
      gradientHeader={header}
      actionBar={
        <ActionBar>
          <Button label="Sinkronkan sekarang" icon="refresh" onPress={() => void syncNow()} loading={syncing} disabled={!online} />
        </ActionBar>
      }
      overlay={
        conflictFor ? (
          <ConflictSheet
            conflict={conflictFor}
            onClose={() => setConflictFor(null)}
            onResolve={(choice) => {
              resolveConflict(conflictFor.opId, choice);
              setConflictFor(null);
            }}
          />
        ) : null
      }
    >
      {!online ? (
        <Banner type="offline" title="Anda sedang offline" message="Perubahan disimpan di perangkat dan dikirim otomatis saat online." />
      ) : syncing ? (
        <Banner type="syncing" title="Sedang disinkronkan" message={`Mengirim ${queue.length} perubahan…`} />
      ) : failed > 0 ? (
        <Banner
          type="syncFailed"
          title={`${failed} perubahan gagal disinkronkan`}
          message="Lihat detail perubahan. Anda bisa mencoba lagi untuk gangguan sementara atau memperbaiki isian yang ditolak."
          actionLabel="Coba semua"
          onAction={() => void syncNow()}
        />
      ) : null}
      <AppText variant="footnoteEmphasized" tone="secondary">
        {queue.length} perubahan di perangkat ini
      </AppText>
      {queue.map((op) => {
        const info = opTitle(op, plans, records);
        const conflict = conflicts.find((c) => c.opId === op.opId);
        const chip =
          op.status === 'SYNCING'
            ? 'Sedang disinkronkan'
            : op.status === 'FAILED'
              ? 'Gagal disinkronkan'
              : online
                ? 'Menunggu sinkronisasi'
                : 'Tersimpan di perangkat';
        return (
          <View key={op.opId} style={styles.queueRow}>
            <Icon name={info.icon} size={22} />
            <View style={[styles.flex, { gap: spacing.xs }]}>
              <AppText variant="subheadlineEmphasized" numberOfLines={1}>
                {info.title}
              </AppText>
              <AppText variant="footnote" tone="secondary">
                {VERB[op.op]} {relativeDayLabel(toDateKey(new Date(op.createdAt))).toLowerCase()} {formatTime(op.createdAt)}
                {op.lastError ? `, ${op.lastError}` : ''}
                {conflict ? ', diubah juga di perangkat lain' : ''}
              </AppText>
              <View style={styles.wrap}>
                <StatusChip status={conflict ? 'Menunggu sinkronisasi' : chip} />
                {op.status === 'FAILED' && !op.rejected && !conflict ? (
                  <Pressable onPress={() => void retry(op.opId)} accessibilityRole="button" hitSlop={10} disabled={!online}>
                    <AppText variant="footnoteEmphasized">Coba lagi</AppText>
                  </Pressable>
                ) : null}
                {conflict ? (
                  <Pressable onPress={() => setConflictFor(conflict)} accessibilityRole="button" hitSlop={10}>
                    <AppText variant="footnoteEmphasized">Selesaikan perbedaan</AppText>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
      <AppText variant="footnote" tone="secondary">
        Terakhir tersinkron: {lastSyncedLabel(lastSyncedAt)}
      </AppText>
    </Screen>
  );
}

/* ------------------------------ O2 ------------------------------ */

function describe(e: MealPlanEntry | ConsumptionRecord) {
  return 'slot' in e ? e.title : `${e.title}, ${formatTime(e.consumedAt)}`;
}

function ConflictSheet({
  conflict,
  onClose,
  onResolve,
}: {
  conflict: ConflictItem;
  onClose: () => void;
  onResolve: (choice: 'LOCAL' | 'SERVER') => void;
}) {
  const [choice, setChoice] = useState<'LOCAL' | 'SERVER'>('LOCAL');
  const isPlan = conflict.entityType === 'MEAL_PLAN';
  const local = conflict.local;
  const where =
    isPlan && 'slot' in local ? `Rencana ${SLOT_LABEL[local.slot]} ${formatShortDay(local.date).replace(',', '')}` : `Catatan ${local.title}`;
  return (
    <BottomSheet visible title={isPlan ? 'Rencana diubah di dua tempat' : 'Catatan diubah di dua tempat'} onClose={onClose}>
      <AppText variant="subheadline" tone="secondary">
        {where} diubah di perangkat ini dan di perangkat lain. Pilih versi yang ingin disimpan.
      </AppText>
      {(['LOCAL', 'SERVER'] as const).map((c) => {
        const selected = choice === c;
        const entity = c === 'LOCAL' ? conflict.local : conflict.server;
        return (
          <Pressable
            key={c}
            onPress={() => setChoice(c)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={[styles.version, selected ? styles.versionOn : styles.versionOff]}
          >
            <RadioDot selected={selected} />
            <View style={[styles.flex, { gap: spacing.xs }]}>
              <AppText variant="subheadlineEmphasized">{c === 'LOCAL' ? 'Versi perangkat ini' : 'Versi tersimpan di server'}</AppText>
              <AppText variant="footnote" tone="secondary">
                {(c === 'LOCAL' ? conflict.localDeleted : conflict.serverDeleted) ? 'Dihapus' : describe(entity)}
              </AppText>
            </View>
          </Pressable>
        );
      })}
      <Button label="Simpan versi ini" onPress={() => onResolve(choice)} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, alignItems: 'center' },
  queueRow: {
    flexDirection: 'row',
    gap: spacing.m,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
    alignItems: 'flex-start',
  },
  done: { gap: 10, paddingTop: spacing.xxl },
  doneMark: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.stateSuccess2, alignItems: 'center', justifyContent: 'center' },
  version: { flexDirection: 'row', gap: spacing.m, padding: 14, borderRadius: radius.surface, alignItems: 'center' },
  versionOn: { borderWidth: 2, borderColor: colors.labelPrimary },
  versionOff: { borderWidth: 1, borderColor: colors.labelSecondary },
});

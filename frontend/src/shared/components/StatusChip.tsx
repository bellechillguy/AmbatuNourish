import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import type { AssessmentOutcome, Completeness, SyncStatus } from '../domain/types';
import { colors, radius } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

/** Label adalah istilah domain yang tetap — jangan diubah per instance. */
export type ChipStatus =
  | 'Cocok'
  | 'Kurang Cocok'
  | 'Belum Dapat Dinilai'
  | 'Data lengkap'
  | 'Data tidak lengkap'
  | 'Data tidak tersedia'
  | 'Belum diverifikasi'
  | 'Tersimpan di perangkat'
  | 'Menunggu sinkronisasi'
  | 'Sedang disinkronkan'
  | 'Tersinkron'
  | 'Gagal disinkronkan'
  | 'Data mungkin belum terbaru';

interface ChipSpec {
  icon: IconName;
  iconColor?: string;
  surface: ViewStyle;
}

const specs: Record<ChipStatus, ChipSpec> = {
  Cocok: { icon: 'check-circle', iconColor: colors.stateSuccess1, surface: { backgroundColor: colors.stateSuccess2 } },
  'Kurang Cocok': { icon: 'alert', surface: { backgroundColor: colors.neutralOrangeGray } },
  'Belum Dapat Dinilai': { icon: 'help', surface: dashed() },
  'Data lengkap': { icon: 'check', surface: { backgroundColor: colors.neutralGreenGray } },
  'Data tidak lengkap': { icon: 'alert', surface: { backgroundColor: colors.brandYellow55 } },
  'Data tidak tersedia': { icon: 'minus-circle', surface: dashed() },
  'Belum diverifikasi': { icon: 'edit', surface: { backgroundColor: colors.neutralOrangeGray } },
  'Tersimpan di perangkat': { icon: 'device', surface: { backgroundColor: colors.neutralYellowGray } },
  'Menunggu sinkronisasi': { icon: 'clock', surface: { backgroundColor: colors.neutralYellowGray } },
  'Sedang disinkronkan': { icon: 'refresh', surface: { backgroundColor: colors.neutralGreenGray } },
  Tersinkron: { icon: 'cloud-check', surface: { backgroundColor: colors.stateSuccess2 } },
  'Gagal disinkronkan': {
    icon: 'x-circle',
    iconColor: colors.stateError,
    surface: { backgroundColor: colors.neutralWhite, borderWidth: 1.5, borderColor: colors.stateError },
  },
  'Data mungkin belum terbaru': { icon: 'clock', surface: { backgroundColor: colors.brandYellow55 } },
};

function dashed(): ViewStyle {
  return { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.labelSecondary };
}

interface StatusChipProps {
  status: ChipStatus;
  style?: ViewStyle;
}

/** Status Chip — selalu ikon + teks + permukaan (tidak pernah warna saja). Ikon dekoratif. */
export function StatusChip({ status, style }: StatusChipProps) {
  const spec = specs[status];
  return (
    <View style={[styles.chip, spec.surface, style]} accessible accessibilityRole="text" accessibilityLabel={status}>
      <Icon name={spec.icon} size={16} color={spec.iconColor ?? colors.labelPrimary} />
      <AppText variant="footnoteEmphasized">{status}</AppText>
    </View>
  );
}

/* Pemetaan dari tipe domain ke label chip. */
export const outcomeChip: Record<AssessmentOutcome, ChipStatus> = {
  COCOK: 'Cocok',
  KURANG_COCOK: 'Kurang Cocok',
  BELUM_DAPAT_DINILAI: 'Belum Dapat Dinilai',
};

export const completenessChip: Record<Completeness, ChipStatus> = {
  COMPLETE: 'Data lengkap',
  INCOMPLETE: 'Data tidak lengkap',
  INSUFFICIENT: 'Data tidak tersedia',
};

export const syncChip: Record<SyncStatus, ChipStatus> = {
  LOCAL: 'Tersimpan di perangkat',
  PENDING: 'Menunggu sinkronisasi',
  SYNCING: 'Sedang disinkronkan',
  SYNCED: 'Tersinkron',
  FAILED: 'Gagal disinkronkan',
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: radius.chip,
  },
});

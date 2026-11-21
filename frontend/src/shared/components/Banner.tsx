import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type BannerType =
  | 'offline'
  | 'stale'
  | 'pendingSync'
  | 'syncing'
  | 'syncFailed'
  | 'partnerUnavailable'
  | 'info';

const spec: Record<BannerType, { icon: IconName; iconColor?: string; surface: ViewStyle }> = {
  offline: { icon: 'cloud-off', surface: { backgroundColor: colors.neutralYellowGray } },
  stale: { icon: 'clock', surface: { backgroundColor: colors.brandYellow55 } },
  pendingSync: { icon: 'clock', surface: { backgroundColor: colors.neutralYellowGray } },
  syncing: { icon: 'refresh', surface: { backgroundColor: colors.neutralGreenGray } },
  syncFailed: {
    icon: 'x-circle',
    iconColor: colors.stateError,
    surface: { backgroundColor: colors.neutralWhite, borderWidth: 1.5, borderColor: colors.stateError },
  },
  partnerUnavailable: { icon: 'info', surface: { backgroundColor: colors.neutralOrangeGray } },
  info: { icon: 'info', surface: { backgroundColor: colors.neutralGreenGray } },
};

interface BannerProps {
  type: BannerType;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

/** Banner — Offline, Stale data, Pending sync, Syncing, Sync failed, Partner unavailable, Info. */
export function Banner({ type, title, message, actionLabel, onAction, style }: BannerProps) {
  const s = spec[type];
  return (
    <View
      style={[styles.banner, s.surface, style]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Icon name={s.icon} size={20} color={s.iconColor ?? colors.labelPrimary} />
      <View style={styles.text}>
        <AppText variant="subheadlineEmphasized">{title}</AppText>
        {message ? <AppText variant="footnote">{message}</AppText> : null}
      </View>
      {actionLabel ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel} hitSlop={12}>
          <AppText variant="footnoteEmphasized">{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: spacing.m,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: radius.surface,
    alignItems: 'flex-start',
  },
  text: { flex: 1, gap: spacing.xxs },
});

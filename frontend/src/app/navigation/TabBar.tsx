import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../shared/components/AppText';
import { Icon, type IconName } from '../../shared/components/Icon';
import { MIN_TOUCH, colors, spacing } from '../../shared/theme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  HomeTab: { label: 'Beranda', icon: 'home' },
  ProductTab: { label: 'Produk', icon: 'package' },
  PlanTab: { label: 'Rencana', icon: 'calendar' },
  SummaryTab: { label: 'Ringkasan', icon: 'chart' },
  ProfileTab: { label: 'Profil', icon: 'user' },
};

/**
 * Tab tetap terlihat dengan ikon, label, dan penanda posisi aktif.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(spacing.xs, insets.bottom) }]}>
      <View style={styles.tabList} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const tab = TABS[route.name];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            // Re-tap tab aktif: native-stack menangani event tabPress dengan pop ke root.
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <View style={[styles.marker, focused && styles.markerActive]} />
              <Icon name={tab.icon} size={22} color={focused ? colors.brandGreen : colors.labelSecondary} />
              <AppText
                variant={focused ? 'caption2Emphasized' : 'caption2'}
                tone="secondary"
                style={focused && styles.activeLabel}
                align="center"
                maxFontSizeMultiplier={1.25}
              >
                {tab.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.neutralWhite,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    paddingHorizontal: spacing.xs,
  },
  tabList: { flexDirection: 'row', width: '100%', maxWidth: 640, alignSelf: 'center' },
  tab: { flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.xs },
  marker: { width: 22, height: 3, backgroundColor: 'transparent', marginBottom: spacing.xxs },
  markerActive: { backgroundColor: colors.brandGreen, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  activeLabel: { color: colors.brandGreen },
  pressed: { backgroundColor: colors.neutralYellowGray },
});

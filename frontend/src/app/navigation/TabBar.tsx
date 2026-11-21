import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../shared/components/AppText';
import { Icon, type IconName } from '../../shared/components/Icon';
import { colors, spacing } from '../../shared/theme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  HomeTab: { label: 'Beranda', icon: 'home' },
  ProductTab: { label: 'Produk', icon: 'package' },
  PlanTab: { label: 'Rencana', icon: 'calendar' },
  SummaryTab: { label: 'Ringkasan', icon: 'chart' },
  ProfileTab: { label: 'Profil', icon: 'user' },
};

/**
 * Navigation/Tab Bar — 62pt di atas inset bawah. Tab aktif: indikator pil Brand/Green 56×30,
 * label Caption 1/Emphasized. Mengetuk tab aktif kembali ke root stack.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(4, insets.bottom) }]} accessibilityRole="tablist">
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
            style={styles.tab}
          >
            <View style={[styles.indicator, focused && styles.indicatorActive]}>
              <Icon name={tab.icon} size={22} color={focused ? colors.onBrand : colors.labelSecondary} />
            </View>
            <AppText variant={focused ? 'caption1Emphasized' : 'caption1'} tone={focused ? 'primary' : 'secondary'} maxFontSizeMultiplier={1.4}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.neutralWhite,
    borderTopWidth: 1,
    borderTopColor: colors.labelQuaternary,
    paddingTop: 6,
    paddingHorizontal: spacing.s,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 50 },
  indicator: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  indicatorActive: { backgroundColor: colors.brandGreen },
});

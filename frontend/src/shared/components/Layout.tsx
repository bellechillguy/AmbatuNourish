import React, { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUiPrefs } from '../state/PreferencesUiProvider';
import { CONTENT_MAX_WIDTH, colors, radius, spacing } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

interface ScreenProps {
  children: ReactNode;
  /** Jarak antar-elemen konten (Figma: 8–20). */
  gap?: number;
  /** Action Bar di bawah (tetap di atas keyboard). */
  actionBar?: ReactNode;
  scroll?: boolean;
  background?: string;
  /** Layar di dalam tab: bottom inset ditangani tab bar. */
  inTabs?: boolean;
  /** Konten tambahan di luar scroll (sheet, dialog, toast). */
  overlay?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
  testID?: string;
}

/**
 * Kerangka layar: safe area (tanpa hard-code 62/34), padding konten 4/16/24/16,
 * lebar maksimum 560 di tablet, Action Bar menempel di atas keyboard.
 */
export function Screen({
  children,
  gap = spacing.m,
  actionBar,
  scroll = true,
  background = colors.neutralWhite,
  inTabs = false,
  overlay,
  contentStyle,
  keyboard = false,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const content = (
    <View style={[styles.content, { gap }, contentStyle]}>{children}</View>
  );
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  ) : (
    <View style={styles.fill}>{content}</View>
  );

  const bottomInset = actionBar ? 0 : inTabs ? 0 : insets.bottom;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.fill, { backgroundColor: background }]} testID={testID}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' && keyboard ? 'padding' : undefined}
      >
        <View style={[styles.fill, { paddingBottom: bottomInset }]}>{body}</View>
        {actionBar}
      </KeyboardAvoidingView>
      {overlay}
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Action Bar                                                          */
/* ------------------------------------------------------------------ */

export function ActionBar({ children, bordered = true }: { children: ReactNode; bordered?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.actionBar,
        bordered && styles.actionBarBorder,
        { paddingBottom: Math.max(spacing.s, insets.bottom) },
      ]}
    >
      <View style={styles.actionInner}>{children}</View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Top App Bar                                                         */
/* ------------------------------------------------------------------ */

interface TopAppBarProps {
  leading?: 'back' | 'close' | 'none';
  onLeading?: () => void;
  title?: string;
  actions?: { icon: IconName; label: string; onPress: () => void }[];
}

/** Top App Bar 44pt: tombol kembali/tutup 44×44, judul Headline, aksi ikon 44×44. */
export function TopAppBar({ leading = 'back', onLeading, title, actions = [] }: TopAppBarProps) {
  return (
    <View style={styles.topBar}>
      {leading !== 'none' ? (
        <IconButton
          icon={leading === 'back' ? 'back' : 'close'}
          label={leading === 'back' ? 'Kembali' : 'Tutup'}
          onPress={onLeading}
        />
      ) : null}
      <View style={styles.topTitle}>
        {title ? (
          <AppText variant="headline" accessibilityRole="header" numberOfLines={2}>
            {title}
          </AppText>
        ) : null}
      </View>
      {actions.map((a) => (
        <IconButton key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} />
      ))}
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  size = 24,
  color,
  style,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }, style]}
    >
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Section header, list row, tile                                     */
/* ------------------------------------------------------------------ */

export function SectionHeader({
  title,
  variant = 'title2',
  actionLabel,
  onAction,
}: {
  title: string;
  variant?: 'title2' | 'headline';
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant={variant} accessibilityRole="header" style={styles.flex}>
        {title}
      </AppText>
      {actionLabel ? <ActionLink label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export function ActionLink({
  label,
  onPress,
  chevron = true,
  tone = 'primary',
}: {
  label: string;
  onPress?: () => void;
  chevron?: boolean;
  tone?: 'primary' | 'error';
}) {
  const { underlineLinks } = useUiPrefs();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={12}
      style={styles.actionLink}
    >
      <AppText variant="subheadlineEmphasized" tone={tone} style={underlineLinks ? { textDecorationLine: 'underline' } : undefined}>
        {label}
      </AppText>
      {chevron ? <Icon name="chev-right" size={20} /> : null}
    </Pressable>
  );
}

export function Tile({ icon = 'package', tone = 'neutral', size = 48 }: { icon?: IconName; tone?: 'neutral' | 'user'; size?: number }) {
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, backgroundColor: tone === 'user' ? colors.neutralOrangeGray : colors.neutralYellowGray },
      ]}
    >
      <Icon name={icon} size={24} />
    </View>
  );
}

interface ListRowProps {
  title: string;
  subtitle?: string;
  caption?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  accessibilityLabel?: string;
  alignTop?: boolean;
  titleVariant?: 'headline' | 'subheadlineEmphasized' | 'body';
}

/** List Row: padding 12/0, garis bawah Label/Quaternary, chevron 20. */
export function ListRow({
  title,
  subtitle,
  caption,
  leading,
  trailing,
  children,
  onPress,
  chevron = !!onPress,
  accessibilityLabel,
  alignTop,
  titleVariant = 'headline',
}: ListRowProps) {
  const body = (
    <View style={[styles.listRow, alignTop && { alignItems: 'flex-start' }]}>
      {leading}
      <View style={styles.listText}>
        <AppText variant={titleVariant}>{title}</AppText>
        {subtitle ? (
          <AppText variant="footnote" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
        {caption ? (
          <AppText variant="caption1" tone="secondary">
            {caption}
          </AppText>
        ) : null}
        {children}
      </View>
      {trailing}
      {chevron ? <Icon name="chev-right" size={20} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle, caption].filter(Boolean).join(', ')}
      style={({ pressed }) => pressed && { opacity: 0.7 }}
    >
      {body}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Filter chip, sub navigation, notes                                 */
/* ------------------------------------------------------------------ */

export function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={[styles.filterChip, selected ? styles.filterSelected : styles.filterIdle]}
    >
      <AppText variant="subheadlineEmphasized" tone={selected ? 'inverse' : 'primary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Sub navigasi bergaris bawah (Kalender | Favorit, Ringkasan | Riwayat). */
export function SubNavigation<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.subNav} accessibilityRole="tablist">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <Pressable
            key={it.value}
            onPress={() => onChange(it.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.subNavItem, active && styles.subNavActive]}
          >
            <AppText variant={active ? 'headline' : 'headlineRegular'} tone={active ? 'primary' : 'secondary'}>
              {it.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Kartu catatan bertint dengan ikon (info / lock / privacy). */
export function InfoNote({
  icon = 'info',
  children,
  tone = 'yellowGray',
  iconSize = 18,
  style,
}: {
  icon?: IconName;
  children: ReactNode;
  tone?: 'yellowGray' | 'greenGray' | 'orangeGray' | 'yellow';
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    tone === 'greenGray'
      ? colors.neutralGreenGray
      : tone === 'orangeGray'
        ? colors.neutralOrangeGray
        : tone === 'yellow'
          ? colors.brandYellow
          : colors.neutralYellowGray;
  return (
    <View style={[styles.note, { backgroundColor: bg }, style]}>
      <Icon name={icon} size={iconSize} />
      <View style={styles.flex}>
        {typeof children === 'string' ? <AppText variant="footnote">{children}</AppText> : children}
      </View>
    </View>
  );
}

/** Baris berbutir "•" (C3, D3). */
export function Bullet({ children, emphasis = 'subheadlineEmphasized' }: { children: string; emphasis?: 'subheadlineEmphasized' | 'headline' }) {
  return (
    <View style={styles.bullet}>
      <AppText variant={emphasis}>•</AppText>
      <AppText variant="subheadline" tone={emphasis === 'headline' ? 'secondary' : 'primary'} style={styles.flex}>
        {children}
      </AppText>
    </View>
  );
}

/** Meter kemajuan netral (hitam di atas Green Gray), tanpa penilaian warna. */
export function Meter({ ratio, height = 6 }: { ratio: number; height?: number }) {
  const pct = Math.max(0, Math.min(1, ratio));
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height / 2, backgroundColor: colors.labelPrimary }} />
    </View>
  );
}

/** Lingkaran radio 24pt. */
export function RadioDot({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.radio, selected ? styles.radioOn : styles.radioOff]}>
      {selected ? <View style={styles.radioInner} /> : null}
    </View>
  );
}

export function RadioRow({
  label,
  subtitle,
  selected,
  onPress,
  children,
}: {
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={[label, subtitle].filter(Boolean).join(', ')}
      style={styles.radioRow}
    >
      <RadioDot selected={selected} />
      <View style={[styles.flex, { gap: spacing.xs }]}>
        <AppText variant={subtitle ? 'subheadlineEmphasized' : 'body'}>{label}</AppText>
        {subtitle ? (
          <AppText variant="footnote" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
        {children}
      </View>
    </Pressable>
  );
}

/** Switch 52×32 sesuai N3. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityValue={{ text: value ? 'aktif' : 'nonaktif' }}
      style={[styles.switch, { backgroundColor: value ? colors.brandGreen : colors.labelQuaternary, justifyContent: value ? 'flex-end' : 'flex-start' }]}
    >
      <View style={styles.knob} />
    </Pressable>
  );
}

export function Skeleton({ width, height, style }: { width: number | `${number}%`; height: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width, height, borderRadius: 6, backgroundColor: colors.neutralGreenGray }, style]} />;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.labelQuaternary }} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingTop: 4,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xl,
  },
  actionBar: {
    backgroundColor: colors.neutralWhite,
    paddingTop: spacing.m,
    paddingHorizontal: spacing.screen,
  },
  actionBarBorder: { borderTopWidth: 1, borderTopColor: colors.labelQuaternary },
  actionInner: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', gap: spacing.s },
  topBar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  topTitle: { flex: 1 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.s, paddingTop: spacing.s },
  actionLink: { flexDirection: 'row', alignItems: 'center', minHeight: 24 },
  tile: { borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
  },
  listText: { flex: 1, gap: spacing.xxs },
  filterChip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center' },
  filterSelected: { backgroundColor: colors.labelPrimary },
  filterIdle: { borderWidth: 1, borderColor: colors.labelSecondary },
  subNav: { flexDirection: 'row', gap: spacing.xl, alignItems: 'center' },
  subNavItem: { minHeight: 36, paddingTop: 6, paddingBottom: 8, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  subNavActive: { borderBottomColor: colors.brandGreen },
  note: { flexDirection: 'row', gap: spacing.s, padding: spacing.m, borderRadius: radius.surface, alignItems: 'flex-start' },
  bullet: { flexDirection: 'row', gap: 10 },
  track: { width: '100%', backgroundColor: colors.neutralGreenGray, overflow: 'hidden' },
  radio: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderWidth: 2, borderColor: colors.labelPrimary },
  radioOff: { borderWidth: 1.5, borderColor: colors.labelSecondary },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.labelPrimary },
  radioRow: {
    flexDirection: 'row',
    gap: spacing.m,
    alignItems: 'center',
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
    minHeight: 48,
  },
  switch: { width: 52, height: 32, borderRadius: 16, padding: 3, flexDirection: 'row', alignItems: 'center' },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.neutralWhite },
});

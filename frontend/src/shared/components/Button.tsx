import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { MIN_TOUCH, colors, radius, spacing } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type ButtonType = 'primary' | 'secondary' | 'tertiary' | 'destructive';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  type?: ButtonType;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  /** Mengisi lebar penuh (default) atau menyesuaikan isi. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  /** Warna gelap (dipakai di atas kamera C2/C3). */
  onDark?: boolean;
}

/**
 * Button — varian Figma: Primary, Secondary, Tertiary, Destructive, Disabled.
 * Min. target sentuh 48pt. Satu Primary per tampilan. Destructive berupa outline merah.
 */
export function Button({
  label,
  onPress,
  type = 'primary',
  icon,
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
  accessibilityHint,
  onDark = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const variant = isDisabled ? 'disabled' : type;
  const fg = foreground(variant, onDark);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyle(variant, onDark),
        fullWidth ? styles.full : null,
        pressed && !isDisabled ? styles.pressed : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={20} color={fg} /> : null}
          <AppText variant="subheadlineEmphasized" style={[styles.label, { color: fg }]} align="center">
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

function foreground(variant: ButtonType | 'disabled', onDark: boolean): string {
  switch (variant) {
    case 'primary':
      return colors.onBrand;
    case 'destructive':
      return colors.stateError;
    case 'disabled':
      return colors.labelSecondary;
    default:
      return onDark ? colors.neutralWhite : colors.brandGreen;
  }
}

function variantStyle(variant: ButtonType | 'disabled', onDark: boolean): ViewStyle {
  switch (variant) {
    case 'primary':
      return { backgroundColor: colors.brandGreen };
    case 'secondary':
      return { borderWidth: 1, borderColor: onDark ? colors.neutralWhite : colors.borderStrong,
        backgroundColor: onDark ? 'transparent' : colors.neutralWhite };
    case 'destructive':
      return { borderWidth: 1, borderColor: colors.stateError };
    case 'disabled':
      return { backgroundColor: colors.neutralYellowGray };
    default:
      return {};
  }
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    borderRadius: radius.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  row: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.s },
  label: { flexShrink: 1 },
  pressed: { opacity: 0.85 },
});

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme';
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
          <AppText variant="headline" style={{ color: fg }} numberOfLines={2} align="center">
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
      return onDark ? colors.neutralWhite : colors.labelPrimary;
  }
}

function variantStyle(variant: ButtonType | 'disabled', onDark: boolean): ViewStyle {
  switch (variant) {
    case 'primary':
      return { backgroundColor: colors.brandGreen, paddingVertical: 15, paddingHorizontal: 20 };
    case 'secondary':
      return {
        borderWidth: 1.5,
        borderColor: onDark ? colors.neutralWhite : colors.labelPrimary,
        paddingVertical: 15,
        paddingHorizontal: 20,
      };
    case 'destructive':
      return { borderWidth: 1.5, borderColor: colors.stateError, paddingVertical: 15, paddingHorizontal: 20 };
    case 'disabled':
      return { backgroundColor: colors.labelQuaternary, paddingVertical: 15, paddingHorizontal: 20 };
    default:
      return { paddingVertical: 14, paddingHorizontal: 12 };
  }
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.s },
  pressed: { opacity: 0.85 },
});

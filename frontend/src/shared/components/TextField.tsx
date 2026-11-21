import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface TextFieldProps extends Omit<TextInputProps, 'style' | 'editable'> {
  label: string;
  /** Satuan di sisi kanan input (g, ml, kkal, mg). */
  unit?: string;
  helper?: string;
  helperIcon?: IconName;
  error?: string | null;
  disabled?: boolean;
  /** Ikon aksi di kanan (mis. tampilkan kata sandi). */
  trailingIcon?: IconName;
  onTrailingPress?: () => void;
  trailingLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Membuat field berperilaku seperti tombol (untuk picker tanggal/jam). */
  onPressField?: () => void;
}

/**
 * Text Field — state Figma: Default, Focused, Error, Disabled.
 * Error: border merah 2pt + ikon alert + pesan cara memperbaiki (terhubung ke a11y).
 */
export const TextField = forwardRef<TextInputInstance, TextFieldProps>(function TextField(
  {
    label,
    unit,
    helper,
    helperIcon = 'info',
    error,
    disabled = false,
    trailingIcon,
    onTrailingPress,
    trailingLabel,
    style,
    onPressField,
    onFocus,
    onBlur,
    value,
    placeholder,
    ...inputProps
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const state = disabled ? 'disabled' : error ? 'error' : focused ? 'focused' : 'default';
  const borderStyle =
    state === 'error'
      ? { borderColor: colors.stateError, borderWidth: 2 }
      : state === 'focused'
        ? { borderColor: colors.labelPrimary, borderWidth: 2 }
        : state === 'disabled'
          ? { borderColor: colors.labelSecondary, borderWidth: 1.5 }
          : { borderColor: colors.labelSecondary, borderWidth: 1 };

  const a11yHint = error ?? helper;

  const inputBox = (
    <View style={[styles.input, borderStyle]}>
      {onPressField ? (
        <AppText variant="body" tone={value ? 'primary' : 'secondary'} style={styles.flex}>
          {value || placeholder}
        </AppText>
      ) : (
        <TextInput
          ref={ref}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={colors.labelSecondary}
          editable={!disabled}
          accessibilityLabel={label}
          accessibilityHint={a11yHint ?? undefined}
          accessibilityState={{ disabled }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[typography.body, styles.flex, { color: disabled ? colors.labelSecondary : colors.labelPrimary }]}
          maxFontSizeMultiplier={2}
          {...inputProps}
        />
      )}
      {unit ? (
        <AppText variant="body" tone="secondary">
          {unit}
        </AppText>
      ) : null}
      {trailingIcon ? (
        <Pressable
          onPress={onTrailingPress}
          accessibilityRole="button"
          accessibilityLabel={trailingLabel}
          style={styles.trailing}
          hitSlop={4}
        >
          <Icon name={trailingIcon} size={24} />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, style]}>
      <AppText variant="footnoteEmphasized">{label}</AppText>
      {onPressField ? (
        <Pressable
          onPress={disabled ? undefined : onPressField}
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${value ?? ''}`}
          accessibilityHint={a11yHint ?? undefined}
        >
          {inputBox}
        </Pressable>
      ) : (
        inputBox
      )}
      {error ? (
        <View style={styles.helper} accessibilityLiveRegion="polite">
          <Icon name="alert" size={16} color={colors.stateError} />
          <AppText variant="footnote" tone="error" style={styles.flex}>
            {error}
          </AppText>
        </View>
      ) : helper ? (
        <View style={styles.helper}>
          <Icon name={helperIcon} size={16} color={colors.labelSecondary} />
          <AppText variant="footnote" tone="secondary" style={styles.flex}>
            {helper}
          </AppText>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: 6 },
  input: {
    minHeight: 52,
    borderRadius: radius.field,
    backgroundColor: colors.neutralWhite,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingHorizontal: 14,
  },
  flex: { flex: 1 },
  helper: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  trailing: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
});

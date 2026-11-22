import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors, typography, type TypographyVariant } from '../theme';

type Tone = 'primary' | 'secondary' | 'error' | 'inverse' | 'onBrand';

const toneColor: Record<Tone, string> = {
  primary: colors.labelPrimary,
  secondary: colors.labelSecondary,
  error: colors.stateError,
  inverse: colors.neutralWhite,
  onBrand: colors.onBrand,
};

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  align?: TextStyle['textAlign'];
}

/**
 * Gunakan varian tipografi dan beri ruang bagi skala teks perangkat sampai 200%.
 */
export function AppText({ variant = 'body', tone = 'primary', align, style, ...rest }: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={2}
      {...rest}
      style={[typography[variant], { color: toneColor[tone] }, align ? { textAlign: align } : null, style]}
    />
  );
}

import type { TextStyle } from 'react-native';

/** Lora untuk judul utama. Public Sans untuk kontrol, isi, dan angka. */
export const fontFamily = {
  display: 'Lora_500Medium',
  regular: 'PublicSans_400Regular',
  semibold: 'PublicSans_600SemiBold',
  bold: 'PublicSans_700Bold',
  italic: 'PublicSans_400Regular_Italic',
} as const;

const style = (family: string, size: number, lineHeight: number, letterSpacing = 0): TextStyle => ({
  fontFamily: family,
  fontSize: size,
  lineHeight,
  letterSpacing,
});

export const typography = {
  display: style(fontFamily.display, 40, 48, -1.3),
  largeTitle: style(fontFamily.display, 34, 42, -0.9),
  title1: style(fontFamily.display, 30, 38, -0.55),
  title2: style(fontFamily.bold, 22, 28, -0.5),
  figure: { ...style(fontFamily.semibold, 31, 36, -1), fontVariant: ['tabular-nums'] } as TextStyle,
  title3: style(fontFamily.regular, 20, 26),
  title3Emphasized: style(fontFamily.semibold, 20, 26),
  headline: style(fontFamily.bold, 17, 24, -0.2),
  headlineRegular: style(fontFamily.regular, 17, 24),
  body: style(fontFamily.regular, 17, 24),
  bodyEmphasized: style(fontFamily.semibold, 17, 24),
  callout: style(fontFamily.regular, 16, 22),
  subheadline: style(fontFamily.regular, 15, 21),
  subheadlineEmphasized: style(fontFamily.semibold, 15, 21),
  subheadlineItalic: style(fontFamily.italic, 15, 21),
  footnote: style(fontFamily.regular, 14, 20),
  footnoteEmphasized: style(fontFamily.semibold, 14, 20),
  footnoteItalic: style(fontFamily.italic, 14, 20),
  caption1: style(fontFamily.regular, 13, 18),
  caption1Emphasized: style(fontFamily.semibold, 13, 18),
  caption1Italic: style(fontFamily.italic, 13, 18),
  caption2: style(fontFamily.regular, 12, 16),
  caption2Emphasized: style(fontFamily.semibold, 12, 16),
} as const;

export type TypographyVariant = keyof typeof typography;

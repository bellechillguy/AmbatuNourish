import type { TextStyle } from 'react-native';

/**
 * Text styles lokal Figma (Public Sans, OFL, dibundel identik di iOS & Android).
 * Nama varian = nama style Figma tanpa spasi, mis. "Title 2/Regular" → title2.
 */
export const fontFamily = {
  regular: 'PublicSans_400Regular',
  semibold: 'PublicSans_600SemiBold',
  italic: 'PublicSans_400Regular_Italic',
  semiboldItalic: 'PublicSans_600SemiBold_Italic',
} as const;

const style = (family: string, size: number, lineHeight: number): TextStyle => ({
  fontFamily: family,
  fontSize: size,
  lineHeight,
  letterSpacing: 0,
});

export const typography = {
  largeTitle: style(fontFamily.semibold, 32, 40),
  title1: style(fontFamily.semibold, 28, 34),
  title2: style(fontFamily.semibold, 22, 28),
  title3: style(fontFamily.regular, 20, 26),
  title3Emphasized: style(fontFamily.semibold, 20, 26),
  headline: style(fontFamily.semibold, 17, 24),
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

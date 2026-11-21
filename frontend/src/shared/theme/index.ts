export * from './colors';
export * from './typography';

/** Skala spacing dari handoff: 4, 8, 12, 14, 16, 24, 32. Margin layar 16. */
export const spacing = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  ml: 14,
  l: 16,
  xl: 24,
  xxl: 32,
  screen: 16,
} as const;

/** Radius: 6 chip, 10 field, 12 tombol/permukaan, 16 verdict, 20 sheet/dialog. */
export const radius = {
  chip: 6,
  tile: 10,
  field: 10,
  surface: 12,
  verdict: 16,
  sheet: 20,
  pill: 999,
} as const;

/** Target sentuh minimum: 44pt iOS / 48dp Android. */
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const MIN_TOUCH = 44;

/** Lebar konten maksimum untuk tablet / layar besar (handoff: 560pt, di tengah). */
export const CONTENT_MAX_WIDTH = 560;

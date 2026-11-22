export * from './colors';
export * from './typography';

/** Jarak kecil mengelompokkan elemen, jarak besar memisahkan bagian layar. */
export const spacing = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  ml: 14,
  l: 16,
  xl: 24,
  xxl: 32,
  screen: 20,
} as const;

/** Radius berdasarkan ukuran permukaan. */
export const radius = {
  chip: 6,
  tile: 10,
  field: 12,
  surface: 14,
  verdict: 18,
  sheet: 24,
  pill: 999,
} as const;

/** Target sentuh minimum: 44pt iOS / 48dp Android. */
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const MIN_TOUCH = 48;

/** Lebar konten maksimum untuk tablet / layar besar (handoff: 560pt, di tengah). */
export const CONTENT_MAX_WIDTH = 560;

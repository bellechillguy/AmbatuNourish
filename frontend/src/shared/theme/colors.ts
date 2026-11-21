/**
 * Token warna dari Figma "Material UI" → koleksi Colors.
 * Nama mengikuti variabel Figma (Neutral/Black, Brand/Green, Label/Secondary, ...).
 */
export const palette = {
  neutralBlack: '#0E1712',
  neutralWhite: '#FBFCFA',
  neutralYellowGray: '#F2F5F0',
  neutralGreenGray: '#E2F0E7',
  neutralOrangeGray: '#FCEDE2',
  brandGreen: '#00AE42',
  brandYellow: '#F5E6A0',
  stateError: '#EA0029',
  stateSuccess1: '#00953B',
  stateSuccess2: '#D2EADB',
} as const;

export const colors = {
  ...palette,
  /** Label/Primary */
  labelPrimary: palette.neutralBlack,
  /** Label/Secondary — 70% ink, hanya untuk teks pendukung */
  labelSecondary: 'rgba(14, 23, 18, 0.7)',
  /** Grabber sheet (40% ink) */
  labelTertiary: 'rgba(14, 23, 18, 0.4)',
  /** Label/Quaternary — garis pemisah, track, border tipis */
  labelQuaternary: 'rgba(14, 23, 18, 0.2)',
  /** Brand/Yellow 55% — chip/banner "Data tidak lengkap", "Data mungkin belum terbaru" */
  brandYellow55: 'rgba(245, 230, 160, 0.55)',
  /** Scrim sheet/dialog: Neutral/Black 40% */
  scrim: 'rgba(14, 23, 18, 0.4)',
  /** Overlay kamera (C2/C3): Neutral/White 8% dan 16% */
  cameraSurface: 'rgba(255, 253, 247, 0.08)',
  cameraControl: 'rgba(255, 253, 247, 0.16)',
  /**
   * Label di atas Brand/Green. Handoff Figma (16. Token & aksesibilitas) dan deskripsi
   * komponen Button menyatakan label Primary = ink karena putih di atas hijau gagal AA.
   */
  onBrand: palette.neutralBlack,
} as const;

export type ColorToken = keyof typeof colors;

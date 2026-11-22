/** Warna permukaan, teks, dan status untuk light mode AmbatuNourish. */
export const palette = {
  canvas: '#F8F6EF',
  neutralWhite: '#FFFDF7',
  neutralBlack: '#1D2B23',
  neutralYellowGray: '#EFEBDF',
  neutralGreenGray: '#E6EEE3',
  neutralOrangeGray: '#F6E6DA',
  brandGreen: '#22563F',
  brandYellow: '#F2E2AE',
  stateError: '#A62E38',
  stateSuccess1: '#255F43',
  stateSuccess2: '#DEEBDF',
} as const;

export const colors = {
  ...palette,
  labelPrimary: palette.neutralBlack,
  labelSecondary: '#526057',
  labelTertiary: '#7C897E',
  labelQuaternary: '#D9DAD0',
  borderStrong: '#7A8579',
  headerGreen: '#00AE42',
  headerMint: '#BFFDD6',
  brandYellow55: '#F7EED1',
  scrim: 'rgba(20, 30, 24, 0.46)',
  cameraSurface: 'rgba(255, 253, 247, 0.08)',
  cameraControl: 'rgba(255, 253, 247, 0.16)',
  onBrand: palette.neutralWhite,
} as const;

export type ColorToken = keyof typeof colors;

import { formatNumber, formatNutrient, parseDecimal } from '../shared/utils/format';
import { emptyFacts, scaleFacts, scaleValue } from '../shared/domain/nutrients';

describe('format angka Indonesia', () => {
  it('memakai titik ribuan dan koma desimal', () => {
    expect(formatNumber(1240)).toBe('1.240');
    expect(formatNumber(12.4)).toBe('12,4');
    expect(formatNumber(2000, 0)).toBe('2.000');
  });

  it('nol tetap nilai nyata', () => {
    expect(formatNutrient('transFat', 0)).toBe('0 g');
  });

  it('parseDecimal membedakan kosong (unknown) dan nol', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('0')).toBe(0);
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(Number.isNaN(parseDecimal('abc') as number)).toBe(true);
  });
});

describe('normalisasi porsi (BR-02, BR-03)', () => {
  it('unknown tetap unknown setelah diskalakan', () => {
    expect(scaleValue(null, 200)).toBeNull();
  });

  it('nilai per 100 diskalakan ke porsi', () => {
    expect(scaleValue(5, 200)).toBe(10);
    const f = scaleFacts({ ...emptyFacts(), sugar: 16, sodium: null }, 30);
    expect(f.sugar).toBeCloseTo(4.8);
    expect(f.sodium).toBeNull();
    expect(f.energy).toBeNull();
  });
});

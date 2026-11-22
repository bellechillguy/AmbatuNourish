import type { NutrientKey, NutrientValue } from '../domain/types';
import { NUTRIENT_UNIT } from '../domain/nutrients';

/**
 * Format angka gaya Indonesia: pemisah ribuan titik, desimal koma (1.240 · 12,4).
 * Implementasi manual agar konsisten di Hermes (Intl tidak selalu lengkap di Android).
 */
export function formatNumber(value: number, maxFractionDigits = 1): string {
  const factor = Math.pow(10, maxFractionDigits);
  const rounded = Math.round(value * factor) / factor;
  const negative = rounded < 0;
  const [intPart, fracPart] = Math.abs(rounded).toFixed(maxFractionDigits).split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const frac = fracPart ? fracPart.replace(/0+$/, '') : '';
  return `${negative ? '-' : ''}${withThousands}${frac ? `,${frac}` : ''}`;
}

/** Nilai gizi dengan satuan. Gula/protein/lemak memakai 1 desimal bila perlu. */
export function formatNutrient(key: NutrientKey, value: number, fixedDecimal = false): string {
  const unit = NUTRIENT_UNIT[key];
  const digits = unit === 'g' ? 1 : 0;
  const text =
    fixedDecimal && unit === 'g' && value !== 0 && value < 100 ? value.toFixed(1).replace('.', ',') : formatNumber(value, digits);
  return `${text} ${unit}`;
}

/** null → null; dipakai bersama NutrientValueText untuk "Tidak tersedia". */
export function formatNutrientValue(key: NutrientKey, value: NutrientValue, fixedDecimal = false): string | null {
  return value === null ? null : formatNutrient(key, value, fixedDecimal);
}

/** Parse input angka dengan koma desimal. "" → null (tidak diketahui). Bukan angka → NaN. */
export function parseDecimal(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return NaN;
  return Number(normalized);
}

/** Angka ke teks input ("12,4"). */
export function toInputText(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return formatNumber(value, 2).replace(/\./g, '');
}

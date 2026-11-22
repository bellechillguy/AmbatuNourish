import React from 'react';
import { StyleSheet, View, useWindowDimensions, PixelRatio } from 'react-native';

import type { NutrientKey, NutrientValue } from '../domain/types';
import { NUTRIENT_LABEL, NUTRIENT_UNIT, UNIT_SPOKEN } from '../domain/nutrients';
import { formatNutrient } from '../utils/format';
import { colors, spacing } from '../theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

/**
 * Nilai gizi tunggal. Unknown → ikon minus-circle + "Tidak tersedia" (italic, sekunder).
 * Nol dirender sebagai nilai nyata "0 g". Tidak pernah "0" atau "-" untuk unknown.
 */
export function NutrientValueText({
  nutrient,
  value,
  fixedDecimal,
  compact,
}: {
  nutrient: NutrientKey;
  value: NutrientValue;
  fixedDecimal?: boolean;
  compact?: boolean;
}) {
  if (value === null) {
    return (
      <View style={styles.unknown}>
        <Icon name="minus-circle" size={14} color={colors.labelSecondary} />
        <AppText variant={compact ? 'caption1Italic' : 'footnoteItalic'} tone="secondary">
          Tidak tersedia
        </AppText>
      </View>
    );
  }
  return (
    <AppText variant="headline" align="right">
      {formatNutrient(nutrient, value, fixedDecimal)}
    </AppText>
  );
}

interface NutrientRowProps {
  nutrient: NutrientKey;
  /** Kolom A — basis kanonik per 100 g/ml (atau satu-satunya kolom). */
  valueA: NutrientValue;
  /** Kolom B — porsi terpilih / sajian. Opsional. */
  valueB?: NutrientValue;
  hasB?: boolean;
  labelOverride?: string;
  fixedDecimal?: boolean;
  /** Teks basis kolom untuk aksesibilitas, mis. "per 100 mililiter". */
  basisA?: string;
  basisB?: string;
  last?: boolean;
}

/**
 * Nutrient Row — Value A = per 100 g/ml (kanonik), Value B = porsi terpilih.
 * Pada skala teks ≥130% baris bertumpuk (nama di atas nilai) agar nilai tidak terpotong.
 */
export function NutrientRow({
  nutrient,
  valueA,
  valueB,
  hasB = valueB !== undefined,
  labelOverride,
  fixedDecimal,
  basisA,
  basisB,
  last,
}: NutrientRowProps) {
  const { fontScale } = useWindowDimensions();
  const stacked = (fontScale ?? PixelRatio.getFontScale()) >= 1.3;
  const label = labelOverride ?? NUTRIENT_LABEL[nutrient];
  const a11y = buildA11y(label, nutrient, valueA, basisA, hasB ? valueB ?? null : undefined, basisB);

  return (
    <View
      style={[styles.row, stacked && styles.rowStacked, last && styles.noBorder]}
      accessible
      accessibilityLabel={a11y}
    >
      <AppText variant="body" style={stacked ? undefined : styles.label}>
        {label}
      </AppText>
      <View style={styles.values}>
        <View style={[styles.cell, stacked && styles.cellStacked]}>
          <NutrientValueText nutrient={nutrient} value={valueA} fixedDecimal={fixedDecimal} />
        </View>
        {hasB ? (
          <View style={[styles.cell, stacked && styles.cellStacked]}>
            <NutrientValueText nutrient={nutrient} value={valueB ?? null} fixedDecimal={fixedDecimal} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function spoken(nutrient: NutrientKey, value: NutrientValue): string {
  if (value === null) return 'tidak tersedia';
  return formatNutrient(nutrient, value).replace(NUTRIENT_UNIT[nutrient], UNIT_SPOKEN[NUTRIENT_UNIT[nutrient]]);
}

function buildA11y(
  label: string,
  nutrient: NutrientKey,
  a: NutrientValue,
  basisA?: string,
  b?: NutrientValue,
  basisB?: string,
): string {
  const partA = `${spoken(nutrient, a)}${basisA ? ` ${basisA}` : ''}`;
  if (b === undefined) return `${label}, ${partA}`;
  return `${label}: ${partA}, ${spoken(nutrient, b)}${basisB ? ` ${basisB}` : ''}`;
}

/** Header tabel nilai gizi (D4/D5/E3/E4). */
export function NutritionTableHeader({ columns }: { columns: string[] }) {
  return (
    <View style={styles.header} accessibilityRole="header">
      <AppText variant="footnoteEmphasized" tone="secondary" style={styles.label}>
        Nilai gizi
      </AppText>
      {columns.map((c) => (
        <View key={c} style={styles.headerCell}>
          <AppText variant="footnoteEmphasized" tone="secondary" align="right">
            {c}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
  },
  rowStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: spacing.xs },
  noBorder: { borderBottomWidth: 0 },
  label: { flex: 1 },
  values: { flexDirection: 'row', gap: spacing.s },
  cell: { width: 104, alignItems: 'flex-end', justifyContent: 'center' },
  cellStacked: { width: undefined, alignItems: 'flex-start', minWidth: 104 },
  unknown: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingBottom: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelPrimary,
  },
  headerCell: { minWidth: 104, alignItems: 'flex-end' },
});

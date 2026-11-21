import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText, Icon, ListRow, NutrientRow, NutritionTableHeader, StatusChip, Tile, completenessChip } from '../../shared/components';
import { NUTRIENT_LABEL, basisUnit, scaleValue } from '../../shared/domain/nutrients';
import type { Product, ProductSummary } from '../../shared/domain/types';
import { colors, radius, spacing, typography } from '../../shared/theme';
import { formatDate } from '../../shared/utils/date';
import { formatNumber } from '../../shared/utils/format';

/** Search Field 48pt — border 1.5 Label/Secondary, radius 12, ikon search. */
export const SearchField = forwardRef<TextInput, TextInputProps & { onPressField?: () => void }>(function SearchField(
  { onPressField, placeholder = 'Cari nama produk atau barcode', value, ...props },
  ref,
) {
  const inner = (
    <View style={styles.search}>
      <Icon name="search" size={20} />
      {onPressField ? (
        <AppText variant="body" tone={value ? 'primary' : 'secondary'} style={styles.flex}>
          {value || placeholder}
        </AppText>
      ) : (
        <TextInput
          ref={ref}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={colors.labelSecondary}
          style={[typography.body, styles.flex, { color: colors.labelPrimary }]}
          returnKeyType="search"
          accessibilityLabel={placeholder}
          clearButtonMode="while-editing"
          maxFontSizeMultiplier={2}
          {...props}
        />
      )}
    </View>
  );
  if (!onPressField) return inner;
  return (
    <Pressable onPress={onPressField} accessibilityRole="search" accessibilityLabel={placeholder}>
      {inner}
    </Pressable>
  );
});

/** Baris produk dengan provenance & kelengkapan (D1/D2/D6). */
export function ProductRow({
  product,
  onPress,
  showSource = true,
  compact = false,
}: {
  product: ProductSummary;
  onPress: () => void;
  showSource?: boolean;
  compact?: boolean;
}) {
  const user = product.source === 'USER_ENTERED';
  const subtitle = product.brand
    ? `${product.brand}${product.sizeLabel ? ` (${product.sizeLabel})` : ''}`
    : product.sizeLabel;
  const chip = user ? 'Belum diverifikasi' : product.completeness !== 'COMPLETE' ? completenessChip[product.completeness] : 'Data lengkap';
  const sourceLabel = user ? 'Dimasukkan oleh Anda' : 'Open Food Facts';
  return (
    <ListRow
      title={product.name}
      subtitle={subtitle}
      leading={<Tile tone={user ? 'user' : 'neutral'} />}
      onPress={onPress}
      accessibilityLabel={`${product.name}, ${subtitle ?? ''}, ${compact ? '' : chip}, ${sourceLabel}`}
    >
      {compact ? null : (
        <View style={styles.meta}>
          <StatusChip status={chip} />
          {showSource ? (
            <AppText variant="caption1" tone="secondary">
              {sourceLabel}
            </AppText>
          ) : null}
        </View>
      )}
    </ListRow>
  );
}

/** Teks ukuran: "Sapi Rimba, kemasan 200 ml" / "Lumbung (30 g) per sajian". */
export function sizeLine(p: Product): string {
  if (!p.serving) return p.brand ?? '';
  const size = `${formatNumber(p.serving.quantity)} ${p.serving.unit}`;
  if (p.serving.sourceText?.startsWith('kemasan')) return `${p.brand ? `${p.brand}, ` : ''}${p.serving.sourceText}`;
  return `${p.brand ? `${p.brand} ` : ''}(${size})${p.serving.sourceText ? ` ${p.serving.sourceText}` : ''}`;
}

/** Baris provenance (Open Food Facts vs Dimasukkan oleh Anda). */
export function ProvenanceLine({ product }: { product: Product }) {
  if (product.source === 'USER_ENTERED') {
    return (
      <View style={styles.row6}>
        <Icon name="edit" size={16} />
        <AppText variant="footnote" tone="secondary" style={styles.flex}>
          Dimasukkan oleh Anda{product.createdAt ? `, ${formatDate(product.createdAt)}` : ''}, tidak diperiksa oleh sumber resmi
        </AppText>
      </View>
    );
  }
  const total = product.displayNutrients.length;
  const missing = product.missingFields.length;
  return (
    <View style={styles.row6}>
      <Icon name="info" size={16} />
      <AppText variant="footnote" tone="secondary" style={styles.flex}>
        {missing > 0
          ? `Sumber: Open Food Facts, ${missing} dari ${Math.max(total, missing)} nilai gizi tidak tersedia`
          : `Sumber: Open Food Facts${product.fetchedAt ? `, diperbarui ${formatDate(product.fetchedAt)}` : ''}`}
      </AppText>
    </View>
  );
}

/** Tabel nilai gizi: basis kanonik + (opsional) sajian dari sumber. */
export function NutritionTable({ product, portionOverride }: { product: Product; portionOverride?: number }) {
  const unit = basisUnit(product.basis);
  const unitSpoken = unit === 'g' ? 'gram' : 'mililiter';
  const portion = portionOverride ?? product.serving?.quantity;
  const colA = `Per 100 ${unit}`;
  const colB = portion
    ? product.serving && portion === product.serving.quantity && product.source !== 'USER_ENTERED'
      ? `Per sajian ${formatNumber(portion)} ${unit}`
      : `Per ${formatNumber(portion)} ${unit}`
    : undefined;
  return (
    <View>
      <NutritionTableHeader columns={colB ? [colA, colB] : [colA]} />
      {product.displayNutrients.map((k, i) => (
        <NutrientRow
          key={k}
          nutrient={k}
          valueA={product.nutrientsPer100[k]}
          valueB={portion ? scaleValue(product.nutrientsPer100[k], portion) : undefined}
          hasB={!!portion}
          basisA={`per 100 ${unitSpoken}`}
          basisB={colB ? colB.toLowerCase().replace(unit, unitSpoken) : undefined}
          last={i === product.displayNutrients.length - 1}
        />
      ))}
    </View>
  );
}

/** Nutrien di luar tabel utama (progressive disclosure). */
export function otherNutrients(p: Product) {
  return (Object.keys(p.nutrientsPer100) as (keyof Product['nutrientsPer100'])[]).filter(
    (k) => !p.displayNutrients.includes(k) && p.nutrientsPer100[k] !== null,
  );
}

export { NUTRIENT_LABEL };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: spacing.m,
    paddingRight: 14,
    borderWidth: 1.5,
    borderColor: colors.labelSecondary,
    borderRadius: radius.surface,
    backgroundColor: colors.neutralWhite,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, flexWrap: 'wrap', marginTop: spacing.xxs },
  row6: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
});

/**
 * D4 detail lengkap (Open Food Facts) · D5 tidak lengkap & cache · E4 produk buatan saya.
 * Membuka F1 (pilih porsi) → F2/F3/F4, dan G2 bila baki perbandingan penuh.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
import { errorMessage, toAppError } from '../../shared/api/errors';
import {
  ActionBar,
  AppText,
  Banner,
  Button,
  Icon,
  NutrientRow,
  Screen,
  Skeleton,
  StatusChip,
  Tile,
  TopAppBar,
  completenessChip,
  useToast,
} from '../../shared/components';
import { basisUnit, scaleValue } from '../../shared/domain/nutrients';
import type { Product } from '../../shared/domain/types';
import { useCatalogLocal } from '../../shared/state/CatalogLocalProvider';
import { colors, spacing } from '../../shared/theme';
import { ageLabel } from '../../shared/utils/date';
import { catalogService } from '../../services/catalog';
import { CompareLimitSheet } from '../nutritional-assessment/CompareLimitSheet';
import { PortionSheet } from '../nutritional-assessment/PortionSheet';
import { NutritionTable, ProvenanceLine, otherNutrients, sizeLine } from './components';

export function ProductDetailScreen({ route }: { route: { params: { productId: string } } }) {
  const nav = useRootNav();
  const toast = useToast();
  const local = useCatalogLocal();
  const { productId } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [portionOpen, setPortionOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await catalogService.getProduct(productId);
        if (cancelled) return;
        setProduct(p);
        local.rememberProduct(p);
      } catch (e) {
        if (cancelled) return;
        const cached = local.cachedProduct(productId);
        if (cached) setProduct(cached);
        else setError(errorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const refresh = async () => {
    if (!product) return;
    setRefreshing(true);
    try {
      const p = await catalogService.refresh(product.id);
      setProduct(p);
      local.rememberProduct(p);
    } catch (e) {
      toast({ message: toAppError(e).kind === 'OFFLINE' ? 'Masih offline. Coba lagi saat terhubung.' : errorMessage(e) });
    } finally {
      setRefreshing(false);
    }
  };

  const addToCompare = () => {
    if (!product) return;
    const res = local.addToCompare(product.id);
    if (res === 'LIMIT') setLimitOpen(true);
    else
      toast({
        message: res === 'EXISTS' ? 'Sudah ada di perbandingan' : 'Ditambahkan ke perbandingan',
        actionLabel: 'Lihat',
        onAction: () => nav.navigate('Main', { screen: 'ProductTab', params: { screen: 'Compare' } }),
      });
  };

  if (!product) {
    return (
      <Screen gap={14}>
        <TopAppBar onLeading={() => nav.goBack()} />
        {error ? (
          <Banner type="offline" title="Produk tidak dapat dimuat" message={error} />
        ) : (
          <View style={{ gap: spacing.l }} accessibilityLabel="Memuat produk">
            <Skeleton width="70%" height={28} />
            <Skeleton width="40%" height={18} />
            <Skeleton width="100%" height={200} />
          </View>
        )}
      </Screen>
    );
  }

  const user = product.source === 'USER_ENTERED';
  const logSource = user ? 'MANUAL' : 'SEARCH';
  const unit = basisUnit(product.basis);
  const extra = otherNutrients(product);
  const hasBasis = product.basisKnown !== false;

  return (
    <Screen
      gap={14}
      actionBar={
        <ActionBar>
          <Button label="Nilai untuk porsi saya" disabled={!hasBasis} onPress={() => setPortionOpen(true)} />
          <Button
            label="Catat konsumsi"
            disabled={!hasBasis}
            icon="plus"
            type="secondary"
            onPress={() => nav.navigate('LogForm', { source: logSource, productId: product.id })}
          />
        </ActionBar>
      }
      overlay={
        <>
          <PortionSheet
            visible={portionOpen}
            onClose={() => setPortionOpen(false)}
            basis={product.basis}
            serving={product.serving}
            onSubmit={(quantity) => {
              setPortionOpen(false);
              nav.navigate('AssessmentResult', { productId: product.id, quantity, unit });
            }}
          />
          <CompareLimitSheet
            visible={limitOpen}
            newProductId={product.id}
            newProductName={product.name}
            onClose={() => setLimitOpen(false)}
            onReplaced={() => {
              setLimitOpen(false);
              nav.navigate('Main', { screen: 'ProductTab', params: { screen: 'Compare' } });
            }}
          />
        </>
      }
    >
      <TopAppBar
        onLeading={() => nav.goBack()}
        actions={[
          ...(user ? [{ icon: 'edit' as const, label: 'Ubah produk', onPress: () => nav.navigate('ManualProductForm', { productId: product.id }) }] : []),
          ...(hasBasis ? [{ icon: 'compare' as const, label: 'Tambahkan ke perbandingan', onPress: addToCompare }] : []),
          ...(!user && hasBasis ? [{ icon: 'heart' as const, label: 'Simpan sebagai favorit', onPress: () => nav.navigate('FavoriteEdit', { productId: product.id }) }] : []),
        ]}
      />

      {product.isStale ? (
        <Banner
          type="stale"
          title="Data mungkin belum terbaru"
          message={`Terakhir diperbarui ${product.fetchedAt ? ageLabel(product.fetchedAt) : 'sebelumnya'}. Hubungkan internet untuk memeriksa versi terbaru.`}
          actionLabel={refreshing ? 'Memperbarui…' : 'Perbarui'}
          onAction={refresh}
        />
      ) : null}

      <View style={{ gap: 10 }}>
        <View style={styles.headerRow}>
          <Tile tone={user ? 'user' : 'neutral'} />
          <View style={styles.flex}>
            <AppText variant="title2" accessibilityRole="header">
              {product.name}
            </AppText>
            <AppText variant="subheadline" tone="secondary">
              {sizeLine(product)}
            </AppText>
          </View>
        </View>
        <View style={styles.chips}>
          {product.verification === 'UNVERIFIED' ? <StatusChip status="Belum diverifikasi" /> : null}
          <StatusChip status={completenessChip[product.completeness]} />
        </View>
        <ProvenanceLine product={product} />
      </View>

      {hasBasis ? <NutritionTable product={product} /> : (
        <Banner type="info" title="Satuan data gizi belum tersedia" message="Anda dapat menambahkan produk sendiri dari informasi pada kemasan." />
      )}

      <Pressable
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.disclosure}
      >
        <AppText variant="headline" style={styles.flex}>
          Komposisi & alergen
        </AppText>
        <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <Icon name="chev-down" size={20} />
        </View>
      </Pressable>
      {expanded ? (
        <View style={{ gap: spacing.s }}>
          {product.ingredientsText ? (
            <AppText variant="subheadline">{product.ingredientsText}</AppText>
          ) : (
            <AppText variant="subheadlineItalic" tone="secondary">
              Komposisi tidak tersedia
            </AppText>
          )}
          <AppText variant="footnote" tone="secondary">
            Alergen: {product.allergens && product.allergens.length ? product.allergens.join(', ') : 'tidak tercantum di sumber'}
          </AppText>
          {extra.map((k) => (
            <NutrientRow
              key={k}
              nutrient={k}
              valueA={product.nutrientsPer100[k]}
              valueB={product.serving ? scaleValue(product.nutrientsPer100[k], product.serving.quantity) : undefined}
              hasB={!!product.serving}
              basisA={`per 100 ${unit === 'g' ? 'gram' : 'mililiter'}`}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', gap: spacing.m, alignItems: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
    minHeight: 48,
  },
});

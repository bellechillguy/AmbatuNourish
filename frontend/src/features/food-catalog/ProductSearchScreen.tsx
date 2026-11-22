import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import type { ProductStackParamList } from '../../app/navigation/types';
import { useRootNav } from '../../app/navigation/types';
import { ActionLink, AppText, Banner, Button, Screen, SectionHeader, Skeleton } from '../../shared/components';
import { useCatalogLocal } from '../../shared/state/CatalogLocalProvider';
import { useAsync } from '../../shared/state/useAsync';
import { spacing } from '../../shared/theme';
import { catalogService } from '../../services/catalog';
import { ProductRow, SearchField } from './components';

export function ProductSearchScreen() {
  const nav = useNavigation<NativeStackNavigationProp<ProductStackParamList>>();
  const root = useRootNav();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.3;
  const { recent, compareIds } = useCatalogLocal();
  const mine = useAsync(() => catalogService.listMyProducts(), [], { enabled: false });
  const [query, setQuery] = useState('');
  const myProducts = mine.data ?? [];

  useFocusEffect(useCallback(() => {
    void mine.reload();
  }, [mine.reload]));

  const submit = () => {
    const value = query.trim();
    if (!value) return;
    if (/^\d{8,14}$/.test(value)) root.navigate('Lookup', { barcode: value });
    else nav.navigate('SearchResults', { query: value });
  };

  const openProduct = (productId: string) => root.navigate('ProductDetail', { productId });
  const addProduct = () => root.navigate('ManualProductForm', {});
  const recentOff = recent.filter((product) => product.source !== 'USER_ENTERED').slice(0, 3);

  return (
    <Screen inTabs gap={spacing.xl}>
      <View style={styles.group}>
        <AppText variant="largeTitle" accessibilityRole="header">Produk Pangan</AppText>
        <View style={[styles.search, compact && styles.stack]}>
          <View style={styles.flex}>
            <SearchField value={query} onChangeText={setQuery} onSubmitEditing={submit} />
          </View>
          {query.trim() ? <Button label="Cari" onPress={submit} fullWidth={compact} /> : null}
        </View>
        <View style={[styles.actions, compact && styles.stack]}>
          <Button
            label="Pindai barcode"
            icon="scan"
            type="secondary"
            onPress={() => root.navigate('CameraPermission')}
            style={compact ? undefined : styles.flex}
          />
          <Button
            label={compareIds.length ? `Bandingkan (${compareIds.length})` : 'Bandingkan'}
            icon="compare"
            type="tertiary"
            onPress={() => nav.navigate('Compare')}
            style={compact ? undefined : styles.flex}
          />
        </View>
      </View>

      {recentOff.length ? (
        <View style={styles.group}>
          <SectionHeader title="Terakhir dilihat" />
          {recentOff.map((product) => (
            <ProductRow key={product.id} product={product} showSource={false} onPress={() => openProduct(product.id)} />
          ))}
        </View>
      ) : null}

      <View style={styles.group}>
        <SectionHeader
          title="Produk buatan saya"
          actionLabel={myProducts.length ? 'Semua' : undefined}
          onAction={() => nav.navigate('SearchResults', { query: '', filter: 'USER_ENTERED' })}
        />
        {myProducts.slice(0, 2).map((product) => (
          <ProductRow key={product.id} product={product} showSource={false} onPress={() => openProduct(product.id)} />
        ))}
        {mine.loading && !mine.data ? <Skeleton width="100%" height={52} /> : null}
        {mine.error ? (
          <Banner type="info" title="Produk pribadi belum bisa dimuat" actionLabel="Coba lagi" onAction={mine.reload} />
        ) : mine.data && myProducts.length === 0 ? (
          <AppText variant="subheadline" tone="secondary">Tambahkan produk yang belum ada di katalog.</AppText>
        ) : null}
        <ActionLink label="Tambah produk" onPress={addProduct} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  group: { gap: spacing.s },
  search: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.s, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.s },
  stack: { flexDirection: 'column' },
});

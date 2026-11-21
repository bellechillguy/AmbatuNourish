/** D1: Produk — area produk / entri pencarian (tab Produk). */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ProductStackParamList } from '../../app/navigation/types';
import { useRootNav } from '../../app/navigation/types';
import { AppText, Button, Screen, SectionHeader } from '../../shared/components';
import { useCatalogLocal } from '../../shared/state/CatalogLocalProvider';
import { useAsync } from '../../shared/state/useAsync';
import { spacing } from '../../shared/theme';
import { catalogService } from '../../services/catalog';
import { ProductRow, SearchField } from './components';

export function ProductSearchScreen() {
  const nav = useNavigation<NativeStackNavigationProp<ProductStackParamList>>();
  const root = useRootNav();
  const { recent, compareIds } = useCatalogLocal();
  const mine = useAsync(() => catalogService.listMyProducts(), []);
  const [query, setQuery] = useState('');

  const submit = () => {
    const q = query.trim();
    if (/^\d{8,14}$/.test(q)) root.navigate('Lookup', { barcode: q });
    else nav.navigate('SearchResults', { query: q });
  };

  const recentOff = recent.filter((p) => p.source !== 'USER_ENTERED').slice(0, 3);

  return (
    <Screen inTabs gap={14}>
      <AppText variant="largeTitle" accessibilityRole="header">
        Produk Pangan
      </AppText>
      <SearchField value={query} onChangeText={setQuery} onSubmitEditing={submit} />
      <View style={styles.row}>
        <Button label="Pindai" icon="scan" type="secondary" onPress={() => root.navigate('CameraPermission')} style={styles.flex} />
        <Button
          label={compareIds.length ? `Bandingkan, ${compareIds.length}` : 'Bandingkan'}
          icon="compare"
          type="secondary"
          onPress={() => nav.navigate('Compare')}
          style={styles.flex}
          accessibilityHint="Maksimal 3 produk"
        />
      </View>

      <SectionHeader title="Terakhir dilihat" />
      {recentOff.length === 0 ? (
        <AppText variant="subheadline" tone="secondary">
          Produk yang Anda buka akan muncul di sini dan tetap bisa dibuka saat offline.
        </AppText>
      ) : (
        recentOff.map((p) => (
          <ProductRow key={p.id} product={p} showSource={false} onPress={() => root.navigate('ProductDetail', { productId: p.id })} />
        ))
      )}

      <SectionHeader
        title="Produk buatan saya"
        actionLabel="Semua"
        onAction={() => nav.navigate('SearchResults', { query: '', filter: 'USER_ENTERED' })}
      />
      {(mine.data ?? []).slice(0, 2).map((p) => (
        <ProductRow key={p.id} product={p} showSource={false} onPress={() => root.navigate('ProductDetail', { productId: p.id })} />
      ))}
      {mine.data && mine.data.length === 0 ? (
        <AppText variant="subheadline" tone="secondary">
          Belum ada produk yang Anda tambahkan.
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.s },
});

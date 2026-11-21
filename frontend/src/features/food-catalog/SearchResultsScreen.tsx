/** D2 hasil pencarian · D3 tidak ada hasil · D6 pencarian offline / jaringan gagal. */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ProductStackParamList } from '../../app/navigation/types';
import { useRootNav } from '../../app/navigation/types';
import {
  AppText,
  Banner,
  Bullet,
  Button,
  FilterChip,
  Screen,
  SectionHeader,
  Skeleton,
  TopAppBar,
} from '../../shared/components';
import { useCatalogLocal } from '../../shared/state/CatalogLocalProvider';
import { useAsync } from '../../shared/state/useAsync';
import { colors, spacing } from '../../shared/theme';
import { catalogService, type SourceFilter } from '../../services/catalog';
import { ProductRow, SearchField } from './components';

const FILTERS: { value: SourceFilter; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'OPEN_FOOD_FACTS', label: 'Open Food Facts' },
  { value: 'USER_ENTERED', label: 'Buatan saya' },
];

export function SearchResultsScreen({ route }: { route: { params: { query: string; filter?: SourceFilter } } }) {
  const nav = useNavigation<NativeStackNavigationProp<ProductStackParamList>>();
  const root = useRootNav();
  const { searchCache } = useCatalogLocal();
  const [input, setInput] = useState(route.params.query);
  const [query, setQuery] = useState(route.params.query);
  const [filter, setFilter] = useState<SourceFilter>(route.params.filter ?? 'ALL');

  // Debounce ~300 ms (PROPOSED).
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const results = useAsync(() => catalogService.search(query, filter), [query, filter]);
  const openProduct = (id: string) => root.navigate('ProductDetail', { productId: id });
  const addProduct = () => root.navigate('ManualProductForm', { name: query || undefined });

  const offline = results.error && (results.error.kind === 'OFFLINE' || results.error.kind === 'TIMEOUT' || results.error.kind === 'SERVER');
  const cached = offline ? searchCache(query) : [];
  const items = results.data ?? [];

  return (
    <Screen inTabs gap={spacing.m}>
      <TopAppBar onLeading={() => nav.goBack()} />
      <SearchField value={input} onChangeText={setInput} autoFocus={!route.params.query && !route.params.filter} />

      {offline ? (
        <>
          <Banner
            type="offline"
            title={results.error?.kind === 'OFFLINE' ? 'Pencarian butuh koneksi internet' : 'Tidak dapat terhubung ke katalog'}
            message="Anda masih bisa membuka produk yang tersimpan di perangkat."
          />
          {cached.length > 0 ? (
            <>
              <SectionHeader title="Tersimpan di perangkat, mungkin belum terbaru" variant="headline" />
              {cached.map((p) => (
                <ProductRow key={p.id} product={p} compact onPress={() => openProduct(p.id)} />
              ))}
            </>
          ) : null}
          <Button label="Coba lagi" icon="refresh" type="secondary" onPress={results.reload} />
        </>
      ) : (
        <>
          <View style={styles.filters}>
            {FILTERS.map((f) => (
              <FilterChip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </View>

          {results.loading ? (
            <View accessibilityLabel="Memuat hasil" style={{ gap: spacing.s }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeletonRow} importantForAccessibility="no-hide-descendants">
                  <Skeleton width={48} height={48} />
                  <View style={{ flex: 1, gap: spacing.s }}>
                    <Skeleton width="80%" height={18} />
                    <Skeleton width="50%" height={14} />
                  </View>
                </View>
              ))}
            </View>
          ) : results.error ? (
            <Banner type="partnerUnavailable" title="Tidak dapat terhubung ke katalog" message="Coba beberapa saat lagi." actionLabel="Coba lagi" onAction={results.reload} />
          ) : items.length === 0 ? (
            <NoResults query={query} onAdd={addProduct} onScan={() => root.navigate('CameraPermission')} />
          ) : (
            <>
              <AppText variant="footnoteEmphasized" tone="secondary" accessibilityLiveRegion="polite">
                {items.length} produk
              </AppText>
              {items.map((p) => (
                <ProductRow key={p.id} product={p} onPress={() => openProduct(p.id)} />
              ))}
              <View style={styles.footer}>
                <AppText variant="subheadline" tone="secondary">
                  Tidak menemukan yang dicari?
                </AppText>
                <Pressable onPress={addProduct} accessibilityRole="link" hitSlop={10}>
                  <AppText variant="subheadlineEmphasized">Tambahkan produk</AppText>
                </Pressable>
              </View>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function NoResults({ query, onAdd, onScan }: { query: string; onAdd: () => void; onScan: () => void }) {
  return (
    <View style={{ gap: 14 }}>
      <AppText variant="title2" accessibilityRole="header">
        {query ? `Tidak ada produk untuk “${query}”` : 'Belum ada produk'}
      </AppText>
      <Bullet emphasis="headline">Periksa ejaan atau gunakan kata yang lebih umum.</Bullet>
      <Bullet emphasis="headline">Cari dengan barcode di kemasan, biasanya lebih tepat.</Bullet>
      <Bullet emphasis="headline">Masih tidak ada? Tambahkan produk dengan informasi yang Anda ketahui.</Bullet>
      <View style={{ gap: spacing.s, paddingTop: spacing.s }}>
        <Button label="Tambahkan produk" icon="plus" onPress={onAdd} />
        <Button label="Pindai barcode" icon="scan" type="secondary" onPress={onScan} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  skeletonRow: {
    flexDirection: 'row',
    gap: spacing.m,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
    alignItems: 'center',
  },
  footer: { flexDirection: 'row', gap: 6, paddingTop: spacing.s, flexWrap: 'wrap' },
});

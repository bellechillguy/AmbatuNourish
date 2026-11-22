import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Keyboard, View } from 'react-native';

import type { ProductStackParamList } from '../../app/navigation/types';
import { regionalFoodsService } from '../../services/regionalFoods';
import { errorMessage } from '../../shared/api/errors';
import { AppText, Banner, Button, ListRow, Screen, SectionHeader, Skeleton, TopAppBar } from '../../shared/components';
import { useAsync } from '../../shared/state/useAsync';
import { spacing } from '../../shared/theme';
import { formatNumber } from '../../shared/utils/format';
import { SearchField } from './components';

export function RegionalFoodsScreen({ navigation }: NativeStackScreenProps<ProductStackParamList, 'RegionalFoods'>) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const results = useAsync(() => regionalFoodsService.search(query), [query]);

  const search = () => {
    Keyboard.dismiss();
    const nextQuery = input.trim();
    if (nextQuery === query) {
      void results.reload();
      return;
    }
    results.setData(undefined);
    setQuery(nextQuery);
  };

  return (
    <Screen inTabs keyboard gradientHeader={<TopAppBar title="Makanan Daerah" onLeading={() => navigation.goBack()} />}>
      <View style={{ gap: spacing.s }}>
        <SearchField
          placeholder="Cari nama makanan"
          value={input}
          maxLength={120}
          onChangeText={setInput}
          onSubmitEditing={search}
        />
        <Button label="Cari" type="secondary" onPress={search} />
      </View>
      {results.loading ? <Skeleton width="100%" height={52} /> : results.error ? (
        <Banner
          type="partnerUnavailable"
          title="Katalog AmbatuEat belum bisa dimuat"
          message={errorMessage(results.error)}
          actionLabel="Coba lagi"
          onAction={results.reload}
        />
      ) : results.data?.length ? (
        <View>
          <SectionHeader title="Data dari AmbatuEat" />
          {results.data.map((food) => (
            <ListRow
              key={food.id}
              title={food.name}
              subtitle={food.region}
              onPress={() => navigation.navigate('RegionalFoodDetail', { id: food.id })}
            />
          ))}
        </View>
      ) : <AppText tone="secondary">Tidak ada makanan daerah yang ditemukan.</AppText>}
    </Screen>
  );
}

export function RegionalFoodDetailScreen({
  navigation, route,
}: NativeStackScreenProps<ProductStackParamList, 'RegionalFoodDetail'>) {
  const { id } = route.params;
  const result = useAsync(() => regionalFoodsService.detail(id), [id]);
  const food = result.data;

  return (
    <Screen inTabs gradientHeader={<TopAppBar title="Detail Makanan" onLeading={() => navigation.goBack()} />}>
      {result.loading ? <Skeleton width="100%" height={104} /> : result.error ? (
        <Banner
          type="partnerUnavailable"
          title="Detail makanan belum bisa dimuat"
          message={errorMessage(result.error)}
          actionLabel="Coba lagi"
          onAction={result.reload}
        />
      ) : food && (
        <>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="title1" accessibilityRole="header">{food.name}</AppText>
            <AppText tone="secondary">{food.region} · AmbatuEat</AppText>
          </View>
          <AppText>{food.story}</AppText>
          <SectionHeader title="Porsi dan informasi gizi" />
          {food.variants.map((variant, index) => (
            <View key={`${variant.id}:${index}`} style={{ gap: spacing.xs }}>
              <AppText variant="headline">{variant.name}</AppText>
              <AppText tone="secondary">{formatNumber(variant.portionQuantity, 3)} {variant.portionUnit}</AppText>
              {variant.nutrition ? Object.entries(variant.nutrition).map(([label, value]) => (
                <ListRow key={label} title={label} trailing={<AppText>{formatNumber(value, 3)}</AppText>} />
              )) : <AppText tone="secondary">Informasi gizi belum tersedia.</AppText>}
              <AppText variant="footnote" tone="secondary">Sumber data {variant.source}</AppText>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

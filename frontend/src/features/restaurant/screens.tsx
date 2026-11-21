/**
 * 13. Restoran Terdekat (Ambatueat) — M1 izin lokasi, M2 lokasi manual (juga saat izin ditolak),
 * M3 hasil, M4 tidak ada hasil, M5 mitra tidak tersedia.
 * Data restoran HANYA dari Ambatueat (lewat backend/ACL). Kontrak lokasi & hasil masih PENDING;
 * field yang tidak dikembalikan mitra disembunyikan. Menolak izin lokasi tidak memblokir fitur lain.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
import { config } from '../../shared/api/config';
import {
  ActionBar,
  AppText,
  Banner,
  Button,
  Icon,
  ListRow,
  Screen,
  Skeleton,
  Tile,
  TopAppBar,
  useToast,
} from '../../shared/components';
import { SLOT_LABEL } from '../../shared/domain/nutrients';
import { useAsync } from '../../shared/state/useAsync';
import { useOfflineData } from '../../shared/sync/OfflineDataProvider';
import { colors, radius, spacing } from '../../shared/theme';
import { mealPlanningService } from '../../services/mealPlanning';
import { SearchField } from '../food-catalog/components';

const LAST_LOCATION_KEY = 'ambatunourish:last-manual-location';

function MealContext({ planId }: { planId: string }) {
  const { plans } = useOfflineData();
  const entry = plans.find((p) => p.id === planId);
  if (!entry) return null;
  return (
    <View style={styles.mealContext}>
      <Icon name="planned" size={22} />
      <View style={styles.flex}>
        <AppText variant="footnote" tone="secondary">
          Untuk rencana {SLOT_LABEL[entry.slot]}
        </AppText>
        <AppText variant="subheadlineEmphasized">{entry.title}</AppText>
      </View>
    </View>
  );
}

function Attribution() {
  return (
    <View style={styles.attribution}>
      <Icon name="info" size={14} />
      <AppText variant="caption1" tone="secondary" style={styles.flex}>
        Data restoran disediakan oleh Ambatueat. AmbatuNourish tidak menyimpan lokasi restoran.
      </AppText>
    </View>
  );
}

/* ------------------------------ M1 ------------------------------ */

export function LocationPermissionScreen({ route }: { route: { params: { planId: string } } }) {
  const nav = useRootNav();
  const { planId } = route.params;
  const [locating, setLocating] = useState(false);

  const useGps = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        nav.replace('ManualLocation', { planId, denied: true });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      nav.replace('RestaurantResults', { planId, kind: 'GPS', latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      // Lokasi tidak tersedia → lokasi manual.
      nav.replace('ManualLocation', { planId });
    } finally {
      setLocating(false);
    }
  };

  return (
    <Screen
      gap={spacing.l}
      actionBar={
        <ActionBar bordered={false}>
          <Button label="Gunakan lokasi saat ini" icon="gps" onPress={useGps} loading={locating} />
          <Button label="Masukkan lokasi manual" icon="pin" type="secondary" onPress={() => nav.replace('ManualLocation', { planId })} />
        </ActionBar>
      }
    >
      <TopAppBar leading="close" onLeading={() => nav.goBack()} />
      <MealContext planId={planId} />
      <AppText variant="title1" accessibilityRole="header">
        Cari restoran di sekitar Anda
      </AppText>
      <AppText variant="callout" tone="secondary">
        Lokasi dipakai sekali untuk mencari restoran terdekat lewat Ambatueat, hanya saat Anda membuka fitur ini.
      </AppText>
    </Screen>
  );
}

/* ------------------------------ M2 ------------------------------ */

export function ManualLocationScreen({ route }: { route: { params: { planId: string; denied?: boolean } } }) {
  const nav = useRootNav();
  const { planId, denied } = route.params;
  const [text, setText] = useState('');
  const suggestions = useAsync(() => mealPlanningService.suggestLocations(text), [text]);

  useEffect(() => {
    void AsyncStorage.getItem(LAST_LOCATION_KEY).then((v) => v && setText(v));
  }, []);

  const search = async () => {
    const t = text.trim();
    if (!t) return;
    await AsyncStorage.setItem(LAST_LOCATION_KEY, t);
    nav.replace('RestaurantResults', { planId, kind: 'MANUAL', text: t });
  };

  return (
    <Screen
      gap={14}
      keyboard
      actionBar={
        <ActionBar>
          <Button label="Cari di lokasi ini" onPress={search} disabled={!text.trim()} />
        </ActionBar>
      }
    >
      <TopAppBar onLeading={() => nav.goBack()} title="Lokasi pencarian" />
      {denied ? (
        <Banner
          type="info"
          title="Akses lokasi tidak diizinkan"
          message="Masukkan area atau alamat untuk mencari restoran. Anda bisa mengizinkan lokasi kapan saja di Pengaturan."
          actionLabel="Pengaturan"
          onAction={() => void Linking.openSettings()}
        />
      ) : null}
      <SearchField value={text} onChangeText={setText} placeholder="Area atau alamat" onSubmitEditing={search} />
      {(suggestions.data ?? []).length > 0 ? (
        <>
          <AppText variant="footnoteEmphasized" tone="secondary">
            Saran
          </AppText>
          {suggestions.data!.map((s) => (
            <ListRow
              key={s.title}
              title={s.title}
              subtitle={s.kind}
              leading={
                <View style={styles.pinBox}>
                  <Icon name="pin" size={22} />
                </View>
              }
              chevron={false}
              onPress={() => setText(s.title)}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

/* ------------------------------ M3 / M4 / M5 ------------------------------ */

export function RestaurantResultsScreen({
  route,
}: {
  route: { params: { planId: string; kind: 'GPS' | 'MANUAL'; text?: string; latitude?: number; longitude?: number } };
}) {
  const nav = useRootNav();
  const toast = useToast();
  const { plans } = useOfflineData();
  const { planId, kind, text, latitude, longitude } = route.params;
  const entry = plans.find((p) => p.id === planId);
  const results = useAsync(
    () => (entry ? mealPlanningService.findRestaurants(entry, { kind, text, latitude, longitude }) : Promise.resolve([])),
    [planId, kind, text, latitude, longitude],
  );
  const changeLocation = () => nav.replace('ManualLocation', { planId });
  const list = results.data ?? [];
  const partnerDown = results.error && results.error.kind !== 'OFFLINE';

  return (
    <Screen gap={spacing.m}>
      <TopAppBar onLeading={() => nav.goBack()} title="Restoran terdekat" />
      <MealContext planId={planId} />

      {results.error ? (
        <>
          <Banner
            type={partnerDown ? 'partnerUnavailable' : 'offline'}
            title={partnerDown ? 'Layanan Ambatueat sedang tidak tersedia' : 'Pencarian restoran butuh koneksi internet'}
            message="Pencarian restoran tidak bisa dilakukan saat ini. Rencana makan Anda tidak terpengaruh."
            actionLabel="Coba lagi"
            onAction={results.reload}
          />
          <Button label="Kembali ke rencana" icon="back" type="secondary" onPress={() => nav.goBack()} />
        </>
      ) : (
        <>
          <Pressable onPress={changeLocation} accessibilityRole="button" accessibilityLabel="Ubah lokasi pencarian" style={styles.locationChip}>
            <Icon name="pin" size={18} />
            <AppText variant="subheadlineEmphasized" style={styles.flex}>
              {kind === 'GPS' ? 'Dekat lokasi Anda saat ini' : `Dekat ${text}`}
            </AppText>
            <AppText variant="subheadlineEmphasized">Ubah</AppText>
          </Pressable>

          {results.loading ? (
            <View style={{ gap: spacing.m }} accessibilityLabel="Mencari restoran">
              <AppText variant="footnoteEmphasized" tone="secondary">
                Mencari restoran…
              </AppText>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <Skeleton width={48} height={48} />
                  <View style={{ flex: 1, gap: spacing.s }}>
                    <Skeleton width="70%" height={18} />
                    <Skeleton width="50%" height={14} />
                  </View>
                </View>
              ))}
            </View>
          ) : list.length === 0 ? (
            <View style={{ gap: 14 }}>
              <AppText variant="title2">Belum ada restoran yang cocok di sekitar sini</AppText>
              <AppText variant="subheadline" tone="secondary">
                Ambatueat tidak menemukan restoran yang menyajikan hidangan ini di dekat lokasi tersebut. Coba lokasi lain, atau
                siapkan sendiri dari rencana Anda.
              </AppText>
              <Button label="Ubah lokasi" icon="pin" type="secondary" onPress={changeLocation} />
            </View>
          ) : (
            <>
              <AppText variant="footnoteEmphasized" tone="secondary">
                {list.length} restoran dari Ambatueat{config.useMock ? ', contoh tampilan' : ''}
              </AppText>
              {list.map((r) => (
                <ListRow
                  key={r.id}
                  title={r.name}
                  subtitle={[r.distanceLabel, r.address].filter(Boolean).join(', ') || undefined}
                  leading={<Tile icon="restaurant" />}
                  onPress={() => toast({ message: 'Membuka di Ambatueat menunggu kontrak mitra' })}
                >
                  {r.matchedMenu ? <AppText variant="footnoteEmphasized">Menu terkait: {r.matchedMenu}</AppText> : null}
                </ListRow>
              ))}
            </>
          )}
          <Attribution />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mealContext: { flexDirection: 'row', gap: 10, padding: spacing.m, borderRadius: radius.surface, backgroundColor: colors.neutralYellowGray, alignItems: 'center' },
  attribution: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', paddingTop: spacing.s },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: 10,
    paddingHorizontal: spacing.m,
    borderRadius: radius.surface,
    borderWidth: 1,
    borderColor: colors.labelSecondary,
    minHeight: 44,
  },
  pinBox: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  skeletonRow: { flexDirection: 'row', gap: spacing.m, alignItems: 'center' },
});

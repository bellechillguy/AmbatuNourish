/**
 * 03. Pindai Barcode — C1 izin kamera, C2 pemindai, C3 tidak terbaca, C4 izin ditolak,
 * C5 mencari produk, C6 produk tidak ditemukan.
 * Kamera hanya membaca ID barcode; data produk diambil dari backend Food Catalog (§8.5).
 */
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRootNav } from '../../app/navigation/types';
import { errorMessage, toAppError, type AppError } from '../../shared/api/errors';
import {
  ActionBar,
  AppText,
  Banner,
  BottomSheet,
  Bullet,
  Button,
  Icon,
  IconButton,
  Screen,
  Skeleton,
  StatusChip,
  TextField,
  TopAppBar,
} from '../../shared/components';
import { useCatalogLocal } from '../../shared/state/CatalogLocalProvider';
import { useUiPrefs } from '../../shared/state/PreferencesUiProvider';
import { colors, radius, spacing } from '../../shared/theme';
import { catalogService } from '../../services/catalog';

/** Format didukung pemindai (EAN/UPC). Klaim dukungan lain perlu diuji. */
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;
/** Barcode tidak terbaca setelah ~8 detik (PROPOSED). */
const UNREADABLE_AFTER_MS = 8000;

const isBarcode = (v: string) => /^\d{8,14}$/.test(v.trim());

function useGoToProductSearch() {
  const nav = useRootNav();
  return () => nav.navigate('Main', { screen: 'ProductTab', params: { screen: 'ProductSearch' } });
}

/* ------------------------------ C1 ------------------------------ */

export function CameraPermissionScreen() {
  const nav = useRootNav();
  const goSearch = useGoToProductSearch();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const p = await Camera.getCameraPermissionsAsync();
      if (p.granted) nav.replace('Scanner');
      else if (!p.canAskAgain) nav.replace('CameraDenied');
      else setChecking(false);
    })();
  }, [nav]);

  const request = async () => {
    const p = await Camera.requestCameraPermissionsAsync();
    nav.replace(p.granted ? 'Scanner' : 'CameraDenied');
  };

  if (checking) return <Screen>{null}</Screen>;

  return (
    <Screen
      gap={spacing.l}
      actionBar={
        <ActionBar bordered={false}>
          <Button label="Lanjutkan" onPress={request} />
          <Button label="Cari dengan nama atau kode" type="tertiary" onPress={goSearch} />
        </ActionBar>
      }
    >
      <TopAppBar leading="close" onLeading={() => nav.goBack()} />
      <AppText variant="title1" accessibilityRole="header">
        Izinkan kamera untuk memindai barcode
      </AppText>
      <AppText variant="callout" tone="secondary">
        Kamera hanya dipakai untuk membaca barcode pada kemasan. Gambar tidak disimpan dan tidak dikirim.
      </AppText>
      <View style={styles.alternative}>
        <AppText variant="subheadlineEmphasized">Tidak ingin memakai kamera?</AppText>
        <AppText variant="subheadline" tone="secondary">
          Anda tetap bisa mencari produk dengan nama atau mengetik kode barcode.
        </AppText>
      </View>
    </Screen>
  );
}

/* ------------------------------ C2 / C3 ------------------------------ */

export function ScannerScreen() {
  const nav = useRootNav();
  const goSearch = useGoToProductSearch();
  const { hapticOnScan, reduceMotion } = useUiPrefs();
  const [permission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [unreadable, setUnreadable] = useState(false);
  const [detected, setDetected] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const line = useRef(new Animated.Value(0)).current;

  const armTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setUnreadable(true), UNREADABLE_AFTER_MS);
  }, []);

  useEffect(() => {
    armTimer();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [armTimer]);

  // Izin dicabut saat layar terbuka → C4.
  useEffect(() => {
    if (permission && !permission.granted) nav.replace('CameraDenied');
  }, [permission, nav]);

  // Animasi garis pindai; dimatikan saat Kurangi gerakan aktif.
  useEffect(() => {
    if (reduceMotion || unreadable) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(line, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(line, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [line, reduceMotion, unreadable]);

  const onScanned = ({ data }: { data: string }) => {
    // Kunci deteksi berulang selama pencarian berlangsung.
    if (locked.current || !data) return;
    locked.current = true;
    if (timer.current) clearTimeout(timer.current);
    setDetected(true);
    if (hapticOnScan) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    AccessibilityInfo.announceForAccessibility('Barcode terdeteksi');
    setTimeout(() => nav.replace('Lookup', { barcode: data }), 250);
  };

  const retry = () => {
    setUnreadable(false);
    armTimer();
  };

  const reticleColor = unreadable ? colors.stateError : colors.brandYellow;
  const translate = line.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] });

  return (
    <SafeAreaView style={styles.dark} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.scannerContent}>
        <View style={styles.scannerBar}>
          <IconButton icon="close" label="Tutup pemindai" size={22} color={colors.neutralWhite} onPress={() => nav.goBack()} style={styles.roundControl} />
          <AppText variant="headline" tone="inverse" accessibilityRole="header">
            Pindai barcode
          </AppText>
          <IconButton
            icon="flash"
            label={torch ? 'Matikan lampu' : 'Nyalakan lampu'}
            size={22}
            color={torch ? colors.brandYellow : colors.neutralWhite}
            onPress={() => setTorch((t) => !t)}
            style={styles.roundControl}
          />
        </View>

        <View style={[styles.preview, { flex: unreadable ? 0 : 1, height: unreadable ? 330 : undefined }]}>
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
              onBarcodeScanned={detected ? undefined : onScanned}
              accessibilityLabel="Pratinjau kamera"
            />
          ) : null}
          <View style={styles.previewOverlay} pointerEvents="none">
            <View
              style={[
                styles.reticle,
                { borderColor: reticleColor, borderStyle: detected || unreadable ? 'solid' : 'dashed' },
              ]}
            >
              <Animated.View
                style={[styles.scanLine, { backgroundColor: reticleColor, transform: [{ translateY: reduceMotion || unreadable ? 0 : translate }] }]}
              />
            </View>
            {/* Teks di atas kamera memakai backplate solid */}
            <View style={styles.backplate}>
              <AppText variant="subheadlineEmphasized" tone="inverse" align="center">
                {unreadable ? 'Barcode belum terbaca' : detected ? 'Barcode terdeteksi' : 'Arahkan barcode ke dalam bingkai'}
              </AppText>
            </View>
          </View>
        </View>

        {unreadable ? (
          <View style={styles.unreadablePanel} accessibilityLiveRegion="polite">
            <View style={styles.row8}>
              <Icon name="alert" size={20} />
              <AppText variant="headline">Barcode belum terbaca</AppText>
            </View>
            <Bullet>Dekatkan atau jauhkan ponsel perlahan</Bullet>
            <Bullet>Pastikan cahaya cukup, nyalakan lampu bila perlu</Bullet>
            <Bullet>Luruskan kemasan yang melengkung</Bullet>
            <View style={styles.row8}>
              <Button label="Ketik kode" type="secondary" onPress={() => setManualOpen(true)} style={styles.flex} />
              <Button label="Coba lagi" onPress={retry} style={styles.flex} />
            </View>
          </View>
        ) : (
          <>
            <AppText variant="footnote" tone="inverse" align="center">
              Barcode akan terbaca otomatis. Pegang ponsel stabil, sekitar 15-20 cm dari kemasan.
            </AppText>
            <View style={styles.row8}>
              <Button label="Ketik kode" icon="keyboard" type="secondary" onDark onPress={() => setManualOpen(true)} style={styles.flex} />
              <Button label="Cari nama" icon="search" type="secondary" onDark onPress={goSearch} style={styles.flex} />
            </View>
          </>
        )}
      </View>

      <ManualBarcodeSheet
        visible={manualOpen}
        onClose={() => setManualOpen(false)}
        onSubmit={(code) => {
          setManualOpen(false);
          nav.replace('Lookup', { barcode: code });
        }}
      />
    </SafeAreaView>
  );
}

function ManualBarcodeSheet({ visible, onClose, onSubmit }: { visible: boolean; onClose: () => void; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    if (!isBarcode(code)) {
      setError('Masukkan 8–14 angka sesuai barcode di kemasan.');
      return;
    }
    onSubmit(code.trim());
  };
  return (
    <BottomSheet visible={visible} title="Ketik kode barcode" onClose={onClose}>
      <TextField
        label="Kode barcode"
        placeholder="Contoh: 8991234567890"
        value={code}
        onChangeText={(t) => {
          setCode(t.replace(/\D/g, ''));
          setError(null);
        }}
        keyboardType="number-pad"
        error={error}
        autoFocus
        returnKeyType="search"
        onSubmitEditing={submit}
      />
      <Button label="Cari produk" icon="search" onPress={submit} />
    </BottomSheet>
  );
}

/* ------------------------------ C4 ------------------------------ */

export function CameraDeniedScreen() {
  const nav = useRootNav();
  const goSearch = useGoToProductSearch();
  const [code, setCode] = useState('');

  // Kembali dari Pengaturan dengan izin diberikan → C2 otomatis.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (s) => {
      if (s !== 'active') return;
      const p = await Camera.getCameraPermissionsAsync();
      if (p.granted) nav.replace('Scanner');
    });
    return () => sub.remove();
  }, [nav]);

  return (
    <Screen
      gap={spacing.l}
      keyboard
      actionBar={
        <ActionBar bordered={false}>
          <Button
            label="Cari produk"
            icon="search"
            onPress={() => (isBarcode(code) ? nav.replace('Lookup', { barcode: code.trim() }) : goSearch())}
          />
          <Button label="Buka Pengaturan" type="secondary" onPress={() => void Linking.openSettings()} />
        </ActionBar>
      }
    >
      <TopAppBar leading="close" onLeading={() => nav.goBack()} />
      <View style={[styles.mark, { backgroundColor: colors.neutralOrangeGray }]}>
        <Icon name="camera" size={30} />
      </View>
      <AppText variant="title1" accessibilityRole="header">
        Kamera tidak diizinkan
      </AppText>
      <AppText variant="callout" tone="secondary">
        Tanpa akses kamera, barcode tidak bisa dipindai. Anda tetap bisa mencari produk atau mengetik kode barcode secara
        manual.
      </AppText>
      <TextField
        label="Kode barcode"
        placeholder="Contoh: 8991234567890"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
        keyboardType="number-pad"
      />
    </Screen>
  );
}

/* ------------------------------ C5 ------------------------------ */

export function LookupScreen({ route }: { route: { params: { barcode: string } } }) {
  const nav = useRootNav();
  const { barcode } = route.params;
  const local = useCatalogLocal();
  const localRef = useRef(local);
  localRef.current = local;
  const [error, setError] = useState<AppError | null>(null);
  const cancelled = useRef(false);

  const run = useCallback(async () => {
    setError(null);
    AccessibilityInfo.announceForAccessibility('Mencari produk');
    try {
      const product = await catalogService.lookupBarcode(barcode);
      if (cancelled.current) return;
      if (product) {
        localRef.current.rememberProduct(product);
        nav.replace('ProductDetail', { productId: product.id });
      } else {
        nav.replace('ProductNotFound', { barcode });
      }
    } catch (e) {
      if (cancelled.current) return;
      const err = toAppError(e);
      // Offline / timeout: pakai produk dari cache perangkat bila ada (→ D5 dengan penanda).
      const { searchCache, cachedProduct } = localRef.current;
      const cached = searchCache(barcode).find((s) => cachedProduct(s.id)?.barcode === barcode);
      if ((err.kind === 'OFFLINE' || err.kind === 'TIMEOUT') && cached) {
        nav.replace('ProductDetail', { productId: cached.id });
        return;
      }
      setError(err);
    }
  }, [barcode, nav]);

  useEffect(() => {
    cancelled.current = false;
    void run();
    return () => {
      cancelled.current = true;
    };
  }, [run]);

  return (
    <Screen
      gap={spacing.l}
      actionBar={
        <ActionBar bordered={false}>
          <Button label={error ? 'Coba lagi' : 'Batalkan'} type={error ? 'primary' : 'tertiary'} onPress={error ? run : () => nav.goBack()} />
        </ActionBar>
      }
    >
      <TopAppBar onLeading={() => nav.goBack()} />
      {error ? (
        <Banner
          type="offline"
          title={error.kind === 'OFFLINE' ? 'Pencarian butuh koneksi internet' : 'Tidak dapat terhubung ke katalog'}
          message={error.kind === 'OFFLINE' ? 'Produk ini belum tersimpan di perangkat.' : errorMessage(error)}
        />
      ) : (
        <>
          <View style={styles.row8} accessibilityLiveRegion="polite">
            <Icon name="refresh" size={20} />
            <AppText variant="subheadlineEmphasized">Mencari {barcode}…</AppText>
          </View>
          {/* Skeleton meniru tata letak D4; disembunyikan dari pembaca layar */}
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ gap: spacing.l }}>
            <View style={styles.row12}>
              <Skeleton width={64} height={64} />
              <View style={{ gap: spacing.s, flex: 1 }}>
                <Skeleton width={220} height={22} />
                <Skeleton width={140} height={16} />
              </View>
            </View>
            <Skeleton width="100%" height={14} />
            <Skeleton width="100%" height={14} />
            <Skeleton width={260} height={14} />
            <Skeleton width="100%" height={120} />
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skeletonRow}>
                <Skeleton width={140} height={14} />
                <Skeleton width={60} height={14} />
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

/* ------------------------------ C6 ------------------------------ */

export function ProductNotFoundScreen({ route }: { route: { params: { barcode: string } } }) {
  const nav = useRootNav();
  const goSearch = useGoToProductSearch();
  const { barcode } = route.params;
  return (
    <Screen
      gap={spacing.l}
      actionBar={
        <ActionBar bordered={false}>
          <Button label="Tambahkan produk" icon="plus" onPress={() => nav.navigate('ManualProductForm', { barcode })} />
          <Button label="Cari dengan nama" icon="search" type="secondary" onPress={goSearch} />
          <Button label="Pindai ulang" type="tertiary" onPress={() => nav.replace('Scanner')} />
        </ActionBar>
      }
    >
      <TopAppBar onLeading={() => nav.goBack()} />
      <AppText variant="title1" accessibilityRole="header">
        Produk belum ada di katalog
      </AppText>
      <View style={styles.barcodeCard}>
        <Icon name="scan" size={22} />
        <View style={styles.flex}>
          <AppText variant="footnote" tone="secondary">
            Barcode terbaca
          </AppText>
          <AppText variant="headline">{barcode}</AppText>
        </View>
        <StatusChip status="Data tidak tersedia" />
      </View>
      <AppText variant="callout" tone="secondary">
        Kodenya terbaca, tetapi produk ini belum tersedia di Open Food Facts maupun katalog AmbatuNourish. Coba cari dengan
        nama, atau tambahkan sendiri.
      </AppText>
      <View style={styles.alternative}>
        <View style={styles.row8}>
          <Icon name="lock" size={18} />
          <AppText variant="subheadlineEmphasized" style={styles.flex}>
            Produk yang Anda tambahkan bersifat pribadi
          </AppText>
        </View>
        <AppText variant="footnote" tone="secondary">
          Hanya terlihat oleh Anda dan ditandai “Belum diverifikasi”.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  row12: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  alternative: { paddingTop: spacing.m, gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.labelQuaternary },
  mark: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  dark: { flex: 1, backgroundColor: colors.neutralBlack },
  scannerContent: { flex: 1, paddingTop: 4, paddingHorizontal: spacing.l, paddingBottom: spacing.xl, gap: spacing.l },
  scannerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  roundControl: { borderRadius: 22, backgroundColor: colors.cameraControl },
  preview: { borderRadius: 16, overflow: 'hidden', backgroundColor: colors.cameraSurface, minHeight: 280 },
  previewOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.m },
  reticle: { width: 300, maxWidth: '86%', height: 170, borderWidth: 3, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scanLine: { width: '87%', height: 2, borderRadius: 1 },
  backplate: { backgroundColor: 'rgba(14, 23, 18, 0.72)', borderRadius: 8, paddingHorizontal: spacing.m, paddingVertical: spacing.xs },
  unreadablePanel: { backgroundColor: colors.neutralWhite, borderRadius: 16, padding: spacing.l, gap: 10 },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
  },
  barcodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.m,
    borderRadius: radius.surface,
    backgroundColor: colors.neutralYellowGray,
    flexWrap: 'wrap',
  },
});

/**
 * 14. Profil & Pengaturan — N1 profil, N2 ubah profil, N3 tampilan & aksesibilitas, N4 keluar.
 * Field identitas dari Identity & Access (PENDING); tidak menambah field tanpa persetujuan.
 */
import React, { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
import { config } from '../../shared/api/config';
import { errorMessage } from '../../shared/api/errors';
import {
  ActionBar,
  AppText,
  Banner,
  Button,
  Dialog,
  Icon,
  InfoNote,
  Screen,
  SectionHeader,
  StatusChip,
  TextField,
  Toggle,
  TopAppBar,
  syncChip,
  useToast,
  type IconName,
} from '../../shared/components';
import { useConnectivity } from '../../shared/state/ConnectivityProvider';
import { useUiPrefs } from '../../shared/state/PreferencesUiProvider';
import { useSession } from '../../shared/state/SessionProvider';
import { useAsync } from '../../shared/state/useAsync';
import { useOfflineData } from '../../shared/sync/OfflineDataProvider';
import { colors, radius, spacing } from '../../shared/theme';
import { assessmentService } from '../../services/assessment';
import { consumptionService } from '../../services/consumption';
import { identityService } from '../../services/identity';
import { demoFlags } from '../../services/mealPlanning';
import { syncDemoFlags } from '../../services/sync';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

/* ------------------------------ N1 / N4 ------------------------------ */

export function ProfileScreen() {
  const nav = useRootNav();
  const toast = useToast();
  const { user, logout } = useSession();
  const { status, queueSize, syncNow, syncing } = useOfflineData();
  const { online } = useConnectivity();
  const prefs = useAsync(() => assessmentService.getPreferences(), []);
  const [confirm, setConfirm] = useState(false);
  const activePrefs = (prefs.data ?? []).filter((p) => p.value != null || (p.ingredients?.length ?? 0) > 0).length;

  const doLogout = async () => {
    setConfirm(false);
    await logout({ clearLocal: true });
  };

  return (
    <Screen
      inTabs
      gap={spacing.s}
      overlay={
        <Dialog
          visible={confirm}
          title="Keluar dari AmbatuNourish?"
          message={
            queueSize > 0
              ? `Masih ada ${queueSize} perubahan yang belum disinkronkan. Jika keluar sekarang, perubahan itu akan hilang dari perangkat ini.`
              : 'Anda perlu masuk lagi untuk melihat rencana dan catatan Anda.'
          }
          onDismiss={() => setConfirm(false)}
        >
          {queueSize > 0 ? (
            <>
              <Button
                label="Sinkronkan dulu"
                icon="refresh"
                loading={syncing}
                disabled={!online}
                onPress={async () => {
                  await syncNow();
                  setConfirm(false);
                  toast({ message: online ? 'Sinkronisasi dijalankan' : 'Masih offline' });
                }}
              />
              <Button label="Keluar tanpa sinkron" type="destructive" onPress={doLogout} />
            </>
          ) : (
            <Button label="Keluar" icon="logout" type="destructive" onPress={doLogout} />
          )}
          <Button label="Batal" type="tertiary" onPress={() => setConfirm(false)} />
        </Dialog>
      }
    >
      <AppText variant="largeTitle" accessibilityRole="header">
        Profil
      </AppText>
      <View style={styles.identity}>
        <View style={styles.avatar} accessible={false}>
          <AppText variant="title3Emphasized">{initials(user?.name ?? '')}</AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="title3Emphasized">{user?.name}</AppText>
          <AppText variant="footnote" tone="secondary">
            {user?.email}
          </AppText>
        </View>
        <Pressable onPress={() => nav.navigate('EditProfile')} accessibilityRole="button" accessibilityLabel="Ubah profil" hitSlop={12}>
          <AppText variant="subheadlineEmphasized">Ubah</AppText>
        </Pressable>
      </View>

      <SettingsRow
        icon="sliders"
        title="Profil Preferensi"
        subtitle={prefs.data ? `${activePrefs} preferensi aktif` : undefined}
        onPress={() => nav.navigate('Main', { screen: 'ProfileTab', params: { screen: 'Preferences' } })}
      />
      <SettingsRow icon="lock" title="Nutrition Plan" subtitle="Dari Ambatufit, hanya baca" onPress={() => nav.navigate('NutritionPlan')} />
      <SettingsRow icon="refresh" title="Status sinkronisasi" onPress={() => nav.navigate('SyncStatus')}>
        <StatusChip status={syncChip[status]} />
      </SettingsRow>
      <SettingsRow
        icon="eye"
        title="Tampilan & aksesibilitas"
        subtitle="Ukuran teks mengikuti perangkat"
        onPress={() => nav.navigate('AccessibilitySettings')}
      />
      <SettingsRow icon="info" title="Tentang AmbatuNourish" subtitle="Sumber data, batasan, dan privasi" onPress={() => nav.navigate('About')} />
      <Pressable onPress={() => setConfirm(true)} accessibilityRole="button" style={styles.settingsRow}>
        <Icon name="logout" size={22} color={colors.stateError} />
        <AppText variant="body" tone="error" style={styles.flex}>
          Keluar
        </AppText>
      </Pressable>
    </Screen>
  );
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  children?: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')} style={styles.settingsRow}>
      <Icon name={icon} size={22} />
      <View style={styles.flex}>
        <AppText variant="body">{title}</AppText>
        {subtitle ? (
          <AppText variant="footnote" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {children}
      <Icon name="chev-right" size={20} />
    </Pressable>
  );
}

/* ------------------------------ N2 ------------------------------ */

export function EditProfileScreen() {
  const nav = useRootNav();
  const toast = useToast();
  const { user, updateProfile } = useSession();
  const [name, setName] = useState(user?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      setError('Nama wajib diisi.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await updateProfile(name.trim());
      toast({ message: 'Profil disimpan' });
      nav.goBack();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      gap={spacing.l}
      keyboard
      actionBar={
        <ActionBar>
          <Button label="Simpan" onPress={save} loading={saving} />
          <Button
            label="Ganti kata sandi"
            type="tertiary"
            onPress={async () => {
              try {
                if (user) await identityService.requestPasswordReset(user.email);
                toast({ message: 'Tautan atur ulang dikirim ke email Anda' });
              } catch (e) {
                toast({ message: errorMessage(e) });
              }
            }}
          />
        </ActionBar>
      }
    >
      <TopAppBar leading="close" onLeading={() => nav.goBack()} title="Ubah profil" />
      {formError ? <Banner type="offline" title="Belum tersimpan" message={formError} /> : null}
      <TextField
        label="Nama"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(null);
        }}
        error={error}
        autoFocus
        autoComplete="name"
      />
      <TextField label="Email" value={user?.email ?? ''} disabled helper="Email dikelola oleh layanan akun dan belum bisa diubah di sini." />
    </Screen>
  );
}

/* ------------------------------ N3 ------------------------------ */

export function AccessibilitySettingsScreen() {
  const nav = useRootNav();
  const prefs = useUiPrefs();
  return (
    <Screen gap={spacing.s}>
      <TopAppBar onLeading={() => nav.goBack()} title="Tampilan & aksesibilitas" />
      <View style={styles.preview}>
        <AppText variant="footnoteEmphasized" tone="secondary">
          Ukuran teks
        </AppText>
        <AppText variant="title3">Gula 10,0 g per sajian</AppText>
        <AppText variant="footnote" tone="secondary">
          Mengikuti pengaturan ukuran teks di perangkat Anda. Ubah di Pengaturan perangkat.
        </AppText>
      </View>
      <ToggleRow
        title="Kurangi gerakan"
        subtitle="Mengikuti perangkat; animasi diganti transisi sederhana"
        value={prefs.reduceMotion}
        onChange={(v) => prefs.set('reduceMotion', v)}
      />
      <ToggleRow title="Getar saat barcode terbaca" value={prefs.hapticOnScan} onChange={(v) => prefs.set('hapticOnScan', v)} />
      <ToggleRow
        title="Garis bawah pada semua tautan"
        subtitle="Membantu membedakan tautan tanpa warna"
        value={prefs.underlineLinks}
        onChange={(v) => prefs.set('underlineLinks', v)}
      />
    </Screen>
  );
}

function ToggleRow({ title, subtitle, value, onChange }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.flex}>
        <AppText variant="body">{title}</AppText>
        {subtitle ? (
          <AppText variant="footnote" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <Toggle value={value} onChange={onChange} label={title} />
    </View>
  );
}

/* ------------------------------ Tentang ------------------------------ */

export function AboutScreen() {
  const nav = useRootNav();
  const { simulateOffline, setSimulateOffline } = useConnectivity();
  const [, force] = useState(0);
  const toggleFlag = (fn: () => void) => {
    fn();
    force((x) => x + 1);
  };
  return (
    <Screen gap={spacing.m}>
      <TopAppBar onLeading={() => nav.goBack()} title="Tentang AmbatuNourish" />
      <InfoNote icon="info">
        AmbatuNourish membantu keputusan makan sehari-hari berdasarkan data gizi dan preferensi Anda. Aplikasi ini bukan alat diagnosis
        dan tidak memberikan saran medis.
      </InfoNote>
      <SectionHeader title="Sumber data" variant="headline" />
      <AppText variant="subheadline" tone="secondary">
        Data produk kemasan berasal dari Open Food Facts melalui katalog AmbatuNourish, dengan tanggal pembaruan dan kelengkapan
        data ditampilkan di setiap produk. Produk yang Anda tambahkan bersifat pribadi dan ditandai “Belum diverifikasi”.
      </AppText>
      <AppText variant="subheadline" tone="secondary">
        Nutrition Plan berasal dari Ambatufit (hanya baca). Data restoran berasal dari Ambatueat.
      </AppText>
      <SectionHeader title="Privasi" variant="headline" />
      <AppText variant="subheadline" tone="secondary">
        Kamera hanya membaca barcode dan gambar tidak disimpan. Lokasi dipakai sekali saat Anda mencari restoran. Catatan konsumsi
        adalah data pribadi Anda.
      </AppText>

      {config.useMock ? (
        <View style={styles.demo}>
          <AppText variant="headline">Mode demo (data contoh)</AppText>
          <AppText variant="footnote" tone="secondary">
            Aplikasi berjalan dengan fixture di perangkat karena kontrak API belum tersedia. Gunakan pengaturan ini untuk mencoba
            state di Figma.
          </AppText>
          <ToggleRow title="Simulasikan offline" subtitle="B3, D6, sinkronisasi tertunda" value={simulateOffline} onChange={setSimulateOffline} />
          <ToggleRow
            title="Ambatueat tidak tersedia"
            subtitle="M5"
            value={demoFlags.partnerDown}
            onChange={(v) => toggleFlag(() => (demoFlags.partnerDown = v))}
          />
          <ToggleRow
            title="Tidak ada restoran"
            subtitle="M4"
            value={demoFlags.emptyRestaurants}
            onChange={(v) => toggleFlag(() => (demoFlags.emptyRestaurants = v))}
          />
          <ToggleRow
            title="Konflik pada perubahan rencana berikutnya"
            subtitle="O2"
            value={syncDemoFlags.nextPlanConflict}
            onChange={(v) => toggleFlag(() => (syncDemoFlags.nextPlanConflict = v))}
          />
          <ToggleRow
            title="Gagal pada sinkronisasi berikutnya"
            subtitle="O1"
            value={syncDemoFlags.failNext}
            onChange={(v) => toggleFlag(() => (syncDemoFlags.failNext = v))}
          />
          <ToggleRow
            title="Tanpa target harian"
            subtitle="L2"
            value={!(consumptionService as unknown as { hasPlan?: boolean }).hasPlan}
            onChange={(v) => toggleFlag(() => ((consumptionService as unknown as { hasPlan: boolean }).hasPlan = !v))}
          />
          <AppText variant="caption1" tone="secondary">
            Akun demo: rani.pratiwi@email.com / demo12345. Barcode 8990001112223 = ditemukan, 8991234567890 = tidak ditemukan.
          </AppText>
        </View>
      ) : null}
      <AppText variant="caption1" tone="secondary">
        Versi 0.1.0
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingTop: spacing.s, paddingBottom: spacing.m },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandYellow, alignItems: 'center', justifyContent: 'center' },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
    minHeight: 53,
  },
  preview: { backgroundColor: colors.neutralYellowGray, borderRadius: radius.surface, padding: spacing.l, gap: 6 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
  },
  demo: { gap: spacing.s, padding: spacing.l, borderRadius: radius.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.labelSecondary },
});

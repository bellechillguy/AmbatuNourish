/**
 * 01. Onboarding & Akun — A1 Selamat datang, A2 Daftar (validasi), A3 Akun berhasil dibuat,
 * A4 Masuk (gagal), A5 Lupa kata sandi, A6 Tautan terkirim.
 * Field & aturan kata sandi mengikuti Identity & Access API (PENDING) — tidak di-hard-code.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Pressable, StyleSheet, View, useWindowDimensions, type TextInputInstance } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
import { errorMessage, toAppError } from '../../shared/api/errors';
import { identityService } from '../../services/identity';
import {
  ActionBar,
  AppText,
  Button,
  Icon,
  Screen,
  TextField,
  TopAppBar,
} from '../../shared/components';
import { useSession } from '../../shared/state/SessionProvider';
import { CONTENT_MAX_WIDTH, colors, radius, spacing } from '../../shared/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const emailError = (v: string) =>
  !v.trim() ? 'Email wajib diisi.' : EMAIL_RE.test(v.trim()) ? null : 'Format email belum lengkap. Contoh: nama@email.com';

/* ------------------------------ A1 ------------------------------ */

export function WelcomeScreen() {
  const nav = useRootNav();
  const { width, height } = useWindowDimensions();
  const contentWidth = Math.min(width, CONTENT_MAX_WIDTH) - spacing.screen * 2;
  const photoHeight = Math.max(100, Math.min(254, contentWidth / 1.6, height / 3));
  return (
    <Screen
      showHeaderGradient={false}
      gap={spacing.l}
      contentStyle={styles.welcome}
      actionBar={
        <ActionBar bordered={false}>
          <Button label="Buat akun" onPress={() => nav.navigate('Register')} />
          <Button label="Masuk" type="secondary" onPress={() => nav.navigate('Login')} />
          <AppText variant="caption1" tone="secondary" align="center">
            Informasi gizi untuk keputusan makan sehari-hari.
          </AppText>
        </ActionBar>
      }
    >
      <AppText variant="subheadlineEmphasized" style={styles.wordmark}>AmbatuNourish</AppText>
      <Image
        source={require('../../../assets/welcome-meal.jpg')}
        resizeMode="cover"
        style={[styles.welcomePhoto, { height: photoHeight }]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      />
      <View style={styles.welcomeCopy}>
        <AppText variant="display" accessibilityRole="header">Kenali pilihan makan Anda</AppText>
        <AppText variant="body" tone="secondary">
          Pindai produk, pahami nilai gizinya, lalu catat apa yang Anda makan.
        </AppText>
      </View>
    </Screen>
  );
}

/* ------------------------------ A2 ------------------------------ */

export function RegisterScreen() {
  const nav = useRootNav();
  const { register } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refs = { name: useRef<TextInputInstance>(null), email: useRef<TextInputInstance>(null), password: useRef<TextInputInstance>(null) };

  const validate = () => {
    const e: Record<string, string | null> = {
      name: name.trim() ? null : 'Nama wajib diisi.',
      email: emailError(email),
      password: password ? null : 'Kata sandi wajib diisi.',
      agreed: agreed ? null : 'Centang pernyataan ini untuk melanjutkan.',
    };
    setErrors(e);
    return e;
  };

  const submit = async () => {
    setFormError(null);
    const e = validate();
    const firstInvalid = (['name', 'email', 'password'] as const).find((k) => e[k]);
    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      AccessibilityInfo.announceForAccessibility(e[firstInvalid] ?? '');
      return;
    }
    if (e.agreed) return;
    setLoading(true);
    try {
      await register({ name: name.trim(), email, password });
      // Navigator berpindah ke A3 (RegisterSuccess) secara otomatis setelah sesi terbentuk.
    } catch (err) {
      const appErr = toAppError(err);
      if (appErr.kind === 'VALIDATION' && appErr.fieldErrors) {
        setErrors((prev) => ({ ...prev, ...appErr.fieldErrors }));
      } else {
        setFormError(errorMessage(appErr));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      gap={20}
      keyboard
      actionBar={
        <ActionBar>
          <Button label="Buat akun" onPress={submit} loading={loading} />
          <InlineLink prefix="Sudah punya akun?" label="Masuk" onPress={() => nav.replace('Login')} />
        </ActionBar>
      }
    >
      <TopAppBar onLeading={() => nav.goBack()} />
      <AppText variant="title1" accessibilityRole="header">
        Buat akun
      </AppText>
      {formError ? <FormError message={formError} /> : null}
      <TextField
        ref={refs.name}
        label="Nama"
        value={name}
        onChangeText={setName}
        onBlur={() => setErrors((e) => ({ ...e, name: name.trim() ? null : 'Nama wajib diisi.' }))}
        error={errors.name}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => refs.email.current?.focus()}
        disabled={loading}
      />
      <TextField
        ref={refs.email}
        label="Email"
        value={email}
        onChangeText={setEmail}
        onBlur={() => email && setErrors((e) => ({ ...e, email: emailError(email) }))}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => refs.password.current?.focus()}
        disabled={loading}
      />
      <TextField
        ref={refs.password}
        label="Kata sandi"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        error={errors.password}
        helper="Ketentuan kata sandi mengikuti layanan akun."
        autoComplete="new-password"
        textContentType="newPassword"
        trailingIcon={showPassword ? 'eye-off' : 'eye'}
        trailingLabel={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        onTrailingPress={() => setShowPassword((s) => !s)}
        disabled={loading}
      />
      <Checkbox
        checked={agreed}
        onChange={(v) => {
          setAgreed(v);
          if (v) setErrors((e) => ({ ...e, agreed: null }));
        }}
        label="Saya memahami AmbatuNourish tidak menggantikan saran dokter atau tenaga kesehatan."
        error={errors.agreed}
      />
    </Screen>
  );
}

/* ------------------------------ A3 ------------------------------ */

export function RegisterSuccessScreen() {
  const nav = useRootNav();
  const { finishOnboarding } = useSession();
  return (
    <Screen
      gap={spacing.l}
      contentStyle={{ paddingTop: 48 }}
      actionBar={
        <ActionBar bordered={false}>
          <Button label="Atur Profil Preferensi" onPress={() => nav.navigate('PreferenceEdit', { onboarding: true })} />
          <Button
            label="Nanti saja"
            type="tertiary"
            onPress={() => {
              nav.reset({ index: 0, routes: [{ name: 'Main' }] });
              finishOnboarding();
            }}
          />
        </ActionBar>
      }
    >
      <View style={[styles.mark, { backgroundColor: colors.stateSuccess2 }]}>
        <Icon name="check" size={28} />
      </View>
      <AppText variant="largeTitle" accessibilityRole="header">
        Akun Anda siap
      </AppText>
      <AppText variant="callout" tone="secondary">
        Langkah berikutnya: atur Profil Preferensi supaya Penilaian Kesesuaian memakai batasan Anda sendiri. Bisa juga
        dilewati dan diatur nanti dari Profil.
      </AppText>
      <View style={styles.planNote}>
        <View style={styles.row8}>
          <Icon name="lock" size={18} />
          <AppText variant="subheadlineEmphasized">Nutrition Plan dari Ambatufit</AppText>
        </View>
        <AppText variant="footnote" tone="secondary">
          Jika Anda punya Nutrition Plan hasil konsultasi, plan itu tampil terpisah dan tidak diubah oleh preferensi Anda.
        </AppText>
      </View>
    </Screen>
  );
}

/* ------------------------------ A4 ------------------------------ */

export function LoginScreen() {
  const nav = useRootNav();
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    setError(null);
    const e = emailError(email);
    setFieldErr(e);
    if (e || !password) {
      if (!password && !e) setError('Masukkan kata sandi Anda.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      const appErr = toAppError(err);
      // Error level form: tidak memberi petunjuk field mana yang salah.
      setError(
        appErr.kind === 'UNAUTHORIZED'
          ? 'Email atau kata sandi tidak cocok. Periksa lagi, atau atur ulang kata sandi.'
          : errorMessage(appErr),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  return (
    <Screen
      gap={20}
      keyboard
      actionBar={
        <ActionBar>
          <Button label="Masuk" onPress={submit} loading={loading} />
          <InlineLink prefix="Belum punya akun?" label="Buat akun" onPress={() => nav.replace('Register')} />
        </ActionBar>
      }
    >
      <TopAppBar onLeading={() => nav.goBack()} />
      <AppText variant="title1" accessibilityRole="header">
        Masuk
      </AppText>
      {error ? <FormError message={error} /> : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={fieldErr}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Kata sandi"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        trailingIcon={showPassword ? 'eye-off' : 'eye'}
        trailingLabel={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        onTrailingPress={() => setShowPassword((s) => !s)}
      />
      <Pressable
        onPress={() => nav.navigate('ForgotPassword', { email })}
        accessibilityRole="link"
        hitSlop={12}
        style={{ alignSelf: 'flex-start' }}
      >
        <AppText variant="subheadlineEmphasized">Lupa kata sandi?</AppText>
      </Pressable>
    </Screen>
  );
}

/* ------------------------------ A5 ------------------------------ */

export function ForgotPasswordScreen({ route }: { route: { params?: { email?: string } } }) {
  const nav = useRootNav();
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { requestReset } = useResetRequest();

  const submit = async () => {
    const e = emailError(email);
    setError(e);
    setFormError(null);
    if (e) return;
    setLoading(true);
    try {
      await requestReset(email.trim());
      nav.replace('ResetLinkSent', { email: email.trim() });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      gap={20}
      keyboard
      actionBar={
        <ActionBar>
          <Button label="Kirim tautan" onPress={submit} loading={loading} />
        </ActionBar>
      }
    >
      <TopAppBar onLeading={() => nav.goBack()} />
      <AppText variant="title1" accessibilityRole="header">
        Atur ulang kata sandi
      </AppText>
      <AppText variant="callout" tone="secondary">
        Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat kata sandi baru.
      </AppText>
      {formError ? <FormError message={formError} /> : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={error}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={submit}
        autoFocus
      />
    </Screen>
  );
}

/* ------------------------------ A6 ------------------------------ */

/** Jeda kirim ulang (PROPOSED; batas sebenarnya dari API). */
const RESEND_SECONDS = 45;

export function ResetLinkSentScreen({ route }: { route: { params: { email: string } } }) {
  const nav = useRootNav();
  const { email } = route.params;
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const { requestReset } = useResetRequest();

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const label = seconds > 0 ? `Kirim ulang dalam 0:${seconds < 10 ? `0${seconds}` : seconds}` : 'Kirim ulang tautan';

  return (
    <Screen
      gap={spacing.l}
      contentStyle={{ paddingTop: 48 }}
      actionBar={
        <ActionBar bordered={false}>
          <Button label="Kembali ke Masuk" onPress={() => nav.navigate('Login')} />
          <Button
            label={label}
            type="tertiary"
            disabled={seconds > 0}
            onPress={async () => {
              await requestReset(email).catch(() => undefined);
              setSeconds(RESEND_SECONDS);
            }}
          />
        </ActionBar>
      }
    >
      <AppText variant="largeTitle" accessibilityRole="header">
        Periksa email Anda
      </AppText>
      {/* Salinan netral: tidak pernah mengonfirmasi email terdaftar. */}
      <AppText variant="callout" tone="secondary">
        Jika {email} terdaftar, tautan atur ulang sudah dikirim. Tautan juga bisa masuk ke folder spam.
      </AppText>
    </Screen>
  );
}

/* ------------------------------ Bagian bersama ------------------------------ */

function useResetRequest() {
  return { requestReset: (email: string) => identityService.requestPasswordReset(email) };
}

export function FormError({ message }: { message: string }) {
  return (
    <View style={styles.formError} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Icon name="x-circle" size={20} color={colors.stateError} />
      <AppText variant="subheadline" style={{ flex: 1 }}>
        {message}
      </AppText>
    </View>
  );
}

function InlineLink({ prefix, label, onPress }: { prefix: string; label: string; onPress: () => void }) {
  return (
    <View style={styles.inlineLink}>
      <AppText variant="subheadline" tone="secondary">
        {prefix}
      </AppText>
      <Pressable onPress={onPress} accessibilityRole="link" hitSlop={12}>
        <AppText variant="subheadlineEmphasized">{label}</AppText>
      </Pressable>
    </View>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  error,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  error?: string | null;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        accessibilityHint={error ?? undefined}
        style={styles.checkboxRow}
      >
        <View style={[styles.checkbox, checked ? styles.checkboxOn : styles.checkboxOff, error ? { borderColor: colors.stateError } : null]}>
          {checked ? <Icon name="check" size={18} color={colors.onBrand} /> : null}
        </View>
        <AppText variant="subheadline" style={{ flex: 1 }}>
          {label}
        </AppText>
      </Pressable>
      {error ? (
        <AppText variant="footnote" tone="error">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  welcome: { paddingTop: spacing.l, paddingBottom: spacing.s },
  wordmark: { color: colors.brandGreen, letterSpacing: -0.2 },
  welcomePhoto: { width: '100%', borderRadius: radius.verdict, backgroundColor: colors.neutralGreenGray },
  welcomeCopy: { gap: spacing.s },
  mark: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  planNote: { backgroundColor: colors.neutralYellowGray, borderRadius: radius.surface, padding: spacing.l, gap: 6 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  formError: {
    flexDirection: 'row',
    gap: 10,
    padding: spacing.m,
    borderRadius: radius.surface,
    borderWidth: 1.5,
    borderColor: colors.stateError,
    alignItems: 'flex-start',
  },
  inlineLink: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  checkboxRow: { flexDirection: 'row', gap: spacing.m, paddingVertical: 10, alignItems: 'flex-start' },
  checkbox: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.brandGreen },
  checkboxOff: { borderWidth: 1.5, borderColor: colors.labelSecondary },
});

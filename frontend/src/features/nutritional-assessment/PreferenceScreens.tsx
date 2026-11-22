/**
 * 08. Preferensi & Nutrition Plan — H1 profil preferensi, H2 ubah (validasi), H3 Nutrition Plan
 * (hanya baca, milik Ambatufit), H4 perbedaan antar sumber.
 * Preferensi milik pengguna; Nutrition Plan read-only dan TIDAK pernah ditimpa preferensi.
 * Jenis & satuan preferensi berasal dari konfigurasi backend; aplikasi tidak menyarankan ambang.
 */
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
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
  Skeleton,
  StatusChip,
  TextField,
  TopAppBar,
  useToast,
} from '../../shared/components';
import type { NutritionPlan, Preference, RuleConflict } from '../../shared/domain/types';
import { useSession } from '../../shared/state/SessionProvider';
import { useAsync } from '../../shared/state/useAsync';
import { colors, radius, spacing, typography } from '../../shared/theme';
import { formatDate, formatTime, todayKey, toDateKey } from '../../shared/utils/date';
import { formatNumber, parseDecimal, toInputText } from '../../shared/utils/format';
import { assessmentService } from '../../services/assessment';

const TYPE_LABEL: Record<Preference['type'], string> = {
  SUGAR_MAX_PER_PORTION: 'Gula',
  SODIUM_MAX_PER_PORTION: 'Natrium',
  AVOID_INGREDIENTS: 'Bahan yang dihindari',
};

function prefValue(p: Preference): string | null {
  if (p.type === 'AVOID_INGREDIENTS') {
    if (!p.ingredients?.length) return null;
    const [first, ...rest] = p.ingredients;
    return [first, ...rest.map((x) => x.toLowerCase())].join(', ');
  }
  return p.value == null ? null : `${formatNumber(p.value)} ${p.unit ?? ''}`.trim();
}

/* ------------------------------ H1 ------------------------------ */

export function PreferencesScreen() {
  const nav = useNavigation();
  const root = useRootNav();
  const prefs = useAsync(() => assessmentService.getPreferences(), []);
  const plan = useAsync(() => assessmentService.getNutritionPlan(), []);
  const conflicts = useAsync(() => assessmentService.getConflicts(), []);

  useFocusEffect(
    useCallback(() => {
      void prefs.reload();
      void conflicts.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const unset = (prefs.data ?? []).find((p) => prefValue(p) === null);
  const conflict = conflicts.data?.[0];

  return (
    <Screen inTabs gap={spacing.m}>
      <TopAppBar onLeading={() => nav.goBack()} />
      <AppText variant="largeTitle" accessibilityRole="header">
        Profil Preferensi
      </AppText>
      <AppText variant="subheadline" tone="secondary">
        Batasan yang dipakai untuk Penilaian Kesesuaian. Ada dua sumber, dan keduanya dipisahkan.
      </AppText>

      {conflict ? (
        <Banner
          type="info"
          title={`Ada ${conflicts.data!.length} perbedaan antar sumber`}
          message={`Batas ${conflict.nutrientLabel} Anda berbeda dengan Nutrition Plan.`}
          actionLabel="Lihat"
          onAction={() => root.navigate('SourceConflict', { conflictId: conflict.id })}
        />
      ) : null}

      <SectionHeader
        title="Preferensi saya"
        actionLabel={unset ? 'Tambah' : undefined}
        onAction={() => unset && root.navigate('PreferenceEdit', { preferenceId: unset.id })}
      />
      {prefs.loading && !prefs.data ? (
        <Skeleton width="100%" height={150} />
      ) : prefs.error ? (
        <Banner type="offline" title="Preferensi belum dapat dimuat" message={errorMessage(prefs.error)} actionLabel="Coba lagi" onAction={prefs.reload} />
      ) : (
        (prefs.data ?? []).map((p) => {
          const v = prefValue(p);
          return (
            <Pressable
              key={p.id}
              onPress={() => root.navigate('PreferenceEdit', { preferenceId: p.id })}
              accessibilityRole="button"
              accessibilityLabel={`${p.label}, ${v ?? 'belum diatur'}. ${v ? 'Ubah' : 'Atur'}`}
              style={styles.prefRow}
            >
              <View style={styles.flex}>
                <AppText variant="body">{p.label}</AppText>
                {v ? (
                  <AppText variant="subheadlineEmphasized">{v}</AppText>
                ) : (
                  <AppText variant="subheadlineItalic" tone="secondary">
                    Belum diatur
                  </AppText>
                )}
              </View>
              <AppText variant="subheadlineEmphasized">{v ? 'Ubah' : 'Atur'}</AppText>
            </Pressable>
          );
        })
      )}

      {plan.data ? (
        <PlanPanel plan={plan.data} compact onDetail={() => root.navigate('NutritionPlan')} />
      ) : plan.loading ? null : (
        <InfoNote icon="lock">Belum ada Nutrition Plan dari Ambatufit.</InfoNote>
      )}
    </Screen>
  );
}

function PlanPanel({ plan, compact, onDetail }: { plan: NutritionPlan; compact?: boolean; onDetail?: () => void }) {
  return (
    <View style={styles.planPanel} accessibilityLabel="Nutrition Plan, hanya baca">
      <View style={styles.planHeader}>
        <Icon name="lock" size={18} />
        <AppText variant="headline" style={styles.flex}>
          Nutrition Plan
        </AppText>
        <AppText variant="caption1Emphasized" tone="secondary">
          Hanya baca
        </AppText>
      </View>
      <AppText variant="footnote" tone="secondary">
        Dari {plan.sourceName}, hasil konsultasi, diterima {formatDate(plan.receivedAt)}
      </AppText>
      {compact ? (
        <Pressable onPress={onDetail} accessibilityRole="link" style={styles.planLink} hitSlop={8}>
          <AppText variant="subheadlineEmphasized">Lihat detail plan</AppText>
          <Icon name="chev-right" size={16} />
        </Pressable>
      ) : (
        plan.targets.map((t) => (
          <View key={t.key} style={styles.metaRow} accessible accessibilityLabel={`${t.label}, ${t.valueLabel}`}>
            <AppText variant="footnote" tone="secondary" style={styles.flex}>
              {t.label}
            </AppText>
            <AppText variant="subheadlineEmphasized" align="right">
              {t.valueLabel}
            </AppText>
          </View>
        ))
      )}
    </View>
  );
}

/* ------------------------------ H2 ------------------------------ */

export function PreferenceEditScreen({ route }: { route: { params?: { preferenceId?: string; onboarding?: boolean } } }) {
  const nav = useRootNav();
  const toast = useToast();
  const { finishOnboarding } = useSession();
  const onboarding = !!route.params?.onboarding;
  const prefs = useAsync(() => assessmentService.getPreferences(), []);
  const pref = prefs.data?.find((p) => p.id === route.params?.preferenceId) ?? (onboarding ? prefs.data?.[0] : undefined);
  // Selesai onboarding (A3 → H2): pindah ke Beranda dulu, lalu hapus A3 dari stack.
  const exitOnboarding = () => {
    nav.reset({ index: 0, routes: [{ name: 'Main' }] });
    finishOnboarding();
  };

  if (!pref) {
    return (
      <Screen>
        <TopAppBar leading="close" onLeading={() => nav.goBack()} />
        {prefs.error ? <Banner type="offline" title="Preferensi belum dapat dimuat" message={errorMessage(prefs.error)} /> : <Skeleton width="100%" height={200} />}
      </Screen>
    );
  }
  return (
    <PreferenceForm
      key={pref.id}
      pref={pref}
      onboarding={onboarding}
      onDone={(msg) => {
        toast({ message: msg });
        if (onboarding) exitOnboarding();
        else nav.goBack();
      }}
      onClose={() => (onboarding ? exitOnboarding() : nav.goBack())}
    />
  );
}

function PreferenceForm({
  pref,
  onboarding,
  onDone,
  onClose,
}: {
  pref: Preference;
  onboarding: boolean;
  onDone: (msg: string) => void;
  onClose: () => void;
}) {
  const isList = pref.type === 'AVOID_INGREDIENTS';
  const [text, setText] = useState(toInputText(pref.value));
  const [tags, setTags] = useState<string[]>(pref.ingredients ?? []);
  const [newTag, setNewTag] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const plan = useAsync(() => assessmentService.getNutritionPlan(), []);
  const planSame = plan.data?.targets.find((t) => (pref.type === 'SODIUM_MAX_PER_PORTION' ? t.key === 'sodium' : pref.type === 'SUGAR_MAX_PER_PORTION' ? t.key === 'sugar' : false));

  const save = async () => {
    setFormError(null);
    let next: Preference;
    if (isList) {
      next = { ...pref, ingredients: tags };
    } else {
      const v = parseDecimal(text);
      if (v === null || Number.isNaN(v) || v <= 0) {
        setError('Masukkan angka lebih dari 0, atau hapus preferensi ini.');
        return;
      }
      next = { ...pref, value: v };
    }
    setSaving(true);
    try {
      await assessmentService.savePreference(next);
      onDone('Preferensi disimpan');
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await assessmentService.deletePreference(pref.id);
      setConfirm(false);
      onDone('Preferensi dihapus');
    } catch (e) {
      setConfirm(false);
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const t = newTag.trim();
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) setTags([...tags, t[0].toUpperCase() + t.slice(1)]);
    setNewTag('');
    setAdding(false);
  };

  const title = isList ? 'Bahan yang dihindari' : `Batas ${TYPE_LABEL[pref.type].toLowerCase()}`;
  const hasValue = isList ? (pref.ingredients?.length ?? 0) > 0 : pref.value != null;

  return (
    <Screen
      gap={spacing.l}
      keyboard
      actionBar={
        <ActionBar>
          <Button label="Simpan" onPress={save} loading={saving} />
          {hasValue && !onboarding ? <Button label="Hapus preferensi" icon="trash" type="destructive" onPress={() => setConfirm(true)} /> : null}
          {onboarding ? <Button label="Nanti saja" type="tertiary" onPress={onClose} /> : null}
        </ActionBar>
      }
      overlay={
        <Dialog
          visible={confirm}
          title="Hapus preferensi ini?"
          message="Batasan ini tidak lagi dipakai dalam Penilaian Kesesuaian. Nutrition Plan dari Ambatufit tidak berubah."
          onDismiss={() => setConfirm(false)}
        >
          <Button label="Hapus preferensi" icon="trash" type="destructive" onPress={remove} loading={saving} />
          <Button label="Batal" type="tertiary" onPress={() => setConfirm(false)} />
        </Dialog>
      }
    >
      <TopAppBar leading="close" onLeading={onClose} title={title} />
      {formError ? <Banner type="offline" title="Belum tersimpan" message={formError} /> : null}
      <TextField label="Jenis batasan" value={TYPE_LABEL[pref.type]} disabled />

      {!isList ? (
        <TextField
          label="Batas maksimum per porsi"
          value={text}
          onChangeText={(t) => {
            setText(t.replace(/[^0-9,.]/g, ''));
            setError(null);
          }}
          unit={pref.unit}
          keyboardType="decimal-pad"
          error={error}
          autoFocus
        />
      ) : (
        <View style={{ gap: 6 }}>
          <AppText variant="footnoteEmphasized">Bahan yang dihindari</AppText>
          <View style={styles.tags}>
            {tags.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTags(tags.filter((x) => x !== t))}
                accessibilityRole="button"
                accessibilityLabel={`${t}, hapus`}
                style={styles.tag}
              >
                <AppText variant="subheadlineEmphasized">{t}</AppText>
                <Icon name="close" size={16} />
              </Pressable>
            ))}
            {adding ? (
              <TextInput
                value={newTag}
                onChangeText={setNewTag}
                onSubmitEditing={addTag}
                onBlur={addTag}
                autoFocus
                placeholder="Nama bahan"
                placeholderTextColor={colors.labelSecondary}
                style={[typography.subheadlineEmphasized, styles.tagInput]}
                accessibilityLabel="Nama bahan yang dihindari"
              />
            ) : (
              <Pressable onPress={() => setAdding(true)} accessibilityRole="button" accessibilityLabel="Tambah bahan" style={styles.addTag}>
                <Icon name="plus" size={16} />
                <AppText variant="subheadlineEmphasized">Tambah</AppText>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {planSame ? (
        <InfoNote icon="lock">
          Nutrition Plan Anda juga memiliki batas {TYPE_LABEL[pref.type].toLowerCase()} {planSame.valueLabel}. Mengubah preferensi ini tidak
          mengubah plan dari Ambatufit.
        </InfoNote>
      ) : (
        <InfoNote icon="lock">Mengubah preferensi ini tidak mengubah Nutrition Plan dari Ambatufit.</InfoNote>
      )}
    </Screen>
  );
}

/* ------------------------------ H3 ------------------------------ */

export function NutritionPlanScreen() {
  const nav = useRootNav();
  const plan = useAsync(() => assessmentService.getNutritionPlan(), []);
  const p = plan.data;
  const checkedToday = p ? toDateKey(new Date(p.checkedAt)) === todayKey() : false;
  return (
    <Screen gap={14}>
      <TopAppBar onLeading={() => nav.goBack()} title="Nutrition Plan" />
      {plan.loading ? (
        <Skeleton width="100%" height={240} />
      ) : !p ? (
        <InfoNote icon="lock">Belum ada Nutrition Plan dari Ambatufit.</InfoNote>
      ) : (
        <>
          {p.isStale ? (
            <Banner
              type="partnerUnavailable"
              title="Layanan Ambatufit sedang tidak tersedia"
              message="Menampilkan plan terakhir yang tersimpan."
              actionLabel="Coba lagi"
              onAction={plan.reload}
            />
          ) : null}
          <PlanPanel plan={p} />
          <View style={{ gap: 6, paddingTop: spacing.xs }}>
            <AppText variant="headline">Siapa yang mengelola plan ini?</AppText>
            <AppText variant="subheadline" tone="secondary">
              Plan ini dikirim oleh Ambatufit berdasarkan konsultasi Anda. AmbatuNourish hanya menampilkannya dan memakainya sebagai
              batasan penilaian. Untuk mengubah plan, hubungi tenaga kesehatan Anda melalui Ambatufit.
            </AppText>
          </View>
          <View style={styles.statusRow}>
            <StatusChip status={p.isStale ? 'Data mungkin belum terbaru' : 'Tersinkron'} />
            <AppText variant="footnote" tone="secondary">
              Diperiksa {checkedToday ? 'hari ini' : formatDate(p.checkedAt)}, {formatTime(p.checkedAt)}
            </AppText>
          </View>
        </>
      )}
    </Screen>
  );
}

/* ------------------------------ H4 ------------------------------ */

export function SourceConflictScreen({ route }: { route: { params: { conflictId: string } } }) {
  const nav = useRootNav();
  const conflicts = useAsync(() => assessmentService.getConflicts(), []);
  const c: RuleConflict | undefined = conflicts.data?.find((x) => x.id === route.params.conflictId);

  return (
    <Screen
      gap={14}
      actionBar={
        <ActionBar>
          <Button
            label="Ubah preferensi saya"
            icon="edit"
            type="secondary"
            onPress={() => c && nav.navigate('PreferenceEdit', { preferenceId: c.preferenceId })}
          />
          <Button label="Mengerti" type="tertiary" onPress={() => nav.goBack()} />
        </ActionBar>
      }
    >
      <TopAppBar onLeading={() => nav.goBack()} title={c ? `Perbedaan batas ${c.nutrientLabel}` : 'Perbedaan antar sumber'} />
      {!c ? (
        conflicts.loading ? (
          <Skeleton width="100%" height={200} />
        ) : (
          <AppText variant="subheadline" tone="secondary">
            Tidak ada perbedaan antar sumber saat ini.
          </AppText>
        )
      ) : (
        <>
          <AppText variant="title2" accessibilityRole="header">
            Dua sumber menetapkan batas yang berbeda
          </AppText>
          <View style={styles.bothSources}>
            <View style={[styles.sourceCard, styles.sourceMine]} accessible accessibilityLabel={`Preferensi saya, ${c.preferenceLabel} per porsi, dapat diubah`}>
              <AppText variant="footnoteEmphasized" tone="secondary">
                Preferensi saya
              </AppText>
              <AppText variant="title2">{c.preferenceLabel}</AppText>
              <AppText variant="caption1" tone="secondary">
                per porsi, dapat diubah
              </AppText>
            </View>
            <View style={[styles.sourceCard, styles.sourcePlan]} accessible accessibilityLabel={`Nutrition Plan, ${c.planLabel} per porsi, dari Ambatufit, hanya baca`}>
              <View style={styles.planHeader}>
                <Icon name="lock" size={14} />
                <AppText variant="footnoteEmphasized" tone="secondary">
                  Nutrition Plan
                </AppText>
              </View>
              <AppText variant="title2">{c.planLabel}</AppText>
              <AppText variant="caption1" tone="secondary">
                per porsi, dari Ambatufit
              </AppText>
            </View>
          </View>
          <AppText variant="subheadline" tone="secondary">
            Kami tidak memilih salah satu secara diam-diam dan tidak mengubah Nutrition Plan. Saat menilai produk, setiap batas
            diperiksa dan sumbernya disebutkan di bagian bukti.
          </AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
    minHeight: 48,
  },
  planPanel: { backgroundColor: colors.neutralYellowGray, borderRadius: radius.surface, paddingTop: 14, paddingHorizontal: spacing.l, paddingBottom: 6 },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingBottom: 10 },
  planLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: spacing.m, paddingBottom: spacing.s, minHeight: 44 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingLeft: 14, paddingRight: spacing.s, borderRadius: 18, backgroundColor: colors.neutralGreenGray },
  addTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.labelSecondary,
  },
  tagInput: { minHeight: 36, minWidth: 120, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.labelPrimary, color: colors.labelPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, flexWrap: 'wrap' },
  bothSources: { flexDirection: 'row', gap: spacing.m },
  sourceCard: { flex: 1, borderRadius: radius.surface, padding: 14, gap: 6 },
  sourceMine: { borderWidth: 1, borderColor: colors.labelSecondary },
  sourcePlan: { backgroundColor: colors.neutralYellowGray },
});

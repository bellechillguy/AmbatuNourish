/**
 * F2 Cocok · F3 Kurang Cocok · F4 Belum Dapat Dinilai — satu layar, tiga varian.
 * Hanya 3 kategori domain; tanpa skor numerik. Bukti per aturan + sumber (Preferensi vs Plan).
 */
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
import { errorMessage } from '../../shared/api/errors';
import {
  ActionBar,
  AppText,
  Banner,
  Button,
  Icon,
  Screen,
  Skeleton,
  StatusChip,
  Tile,
  TopAppBar,
  completenessChip,
  useToast,
} from '../../shared/components';
import type { Assessment, EvidenceItem, Product, QuantityUnit } from '../../shared/domain/types';
import { useCatalogLocal } from '../../shared/state/CatalogLocalProvider';
import { useAsync } from '../../shared/state/useAsync';
import { colors, radius, spacing } from '../../shared/theme';
import { formatNumber } from '../../shared/utils/format';
import { assessmentService } from '../../services/assessment';
import { catalogService } from '../../services/catalog';
import { PortionSheet } from './PortionSheet';

const DISCLAIMER =
  'Penilaian ini membantu keputusan sehari-hari berdasarkan preferensi dan data yang tersedia. Bukan diagnosis atau saran medis.';

export function AssessmentResultScreen({
  route,
}: {
  route: { params: { productId: string; quantity: number; unit: QuantityUnit } };
}) {
  const nav = useRootNav();
  const toast = useToast();
  const { addToCompare } = useCatalogLocal();
  const { productId } = route.params;
  const [quantity, setQuantity] = useState(route.params.quantity);
  const [portionOpen, setPortionOpen] = useState(false);
  const [suggested, setSuggested] = useState<number | undefined>(undefined);

  const product = useAsync<Product>(() => catalogService.getProduct(productId), [productId]);
  const result = useAsync<Assessment>(
    () => assessmentService.assessProduct(productId, { quantity, unit: route.params.unit }),
    [productId, quantity],
  );

  // Verdict diumumkan pertama.
  useEffect(() => {
    if (result.data) AccessibilityInfo.announceForAccessibility(`${verdictLabel(result.data)}. ${result.data.summary}`);
  }, [result.data]);

  const p = product.data;
  const a = result.data;
  const portionLabel = `${formatNumber(quantity)} ${route.params.unit}`;
  const logSource = p?.source === 'USER_ENTERED' ? 'MANUAL' : 'SEARCH';
  const goLog = () => nav.navigate('LogForm', { source: logSource, productId, quantity });

  const actions = !a ? null : a.outcome === 'COCOK' ? (
    <>
      <Button label="Catat konsumsi" icon="plus" onPress={goLog} />
      <Button
        label="Tambah ke rencana makan"
        icon="calendar"
        type="secondary"
        onPress={() =>
          p &&
          nav.navigate('Main', {
            screen: 'PlanTab',
            params: {
              screen: 'PlanHome',
              params: {
                view: 'calendar',
                addProduct: { id: p.id, name: p.name, quantity, unit: route.params.unit, source: p.source },
                nonce: Date.now(),
              },
            },
          })
        }
      />
    </>
  ) : a.outcome === 'KURANG_COCOK' ? (
    <>
      <Button label="Catat konsumsi" icon="plus" type="secondary" onPress={goLog} />
      <Button
        label="Coba porsi lebih kecil"
        type="tertiary"
        onPress={() => {
          setSuggested(Math.max(1, Math.round(quantity / 2)));
          setPortionOpen(true);
        }}
      />
    </>
  ) : (
    <>
      <Button
        label="Cari produk serupa"
        icon="search"
        type="secondary"
        onPress={() =>
          nav.navigate('Main', {
            screen: 'ProductTab',
            params: { screen: 'SearchResults', params: { query: (p?.name ?? '').split(' ').slice(0, 2).join(' ') } },
          })
        }
      />
      <Button label="Tetap catat konsumsi" type="tertiary" onPress={goLog} />
    </>
  );

  return (
    <Screen
      gap={14}
      actionBar={actions ? <ActionBar>{actions}</ActionBar> : undefined}
      overlay={
        p ? (
          <PortionSheet
            visible={portionOpen}
            onClose={() => setPortionOpen(false)}
            basis={p.basis}
            serving={p.serving}
            initialQuantity={suggested ?? quantity}
            onSubmit={(q) => {
              setPortionOpen(false);
              setQuantity(q);
            }}
          />
        ) : null
      }
    >
      <TopAppBar onLeading={() => nav.goBack()} title="Penilaian Kesesuaian" />

      {/* Item yang dinilai + porsi (ketuk porsi → F1) */}
      <View style={styles.assessedItem}>
        <Tile tone={p?.source === 'USER_ENTERED' ? 'user' : 'neutral'} />
        <View style={styles.flex}>
          <AppText variant="headline">{p?.name ?? ' '}</AppText>
          {p?.brand ? (
            <AppText variant="footnote" tone="secondary">
              {p.brand}
            </AppText>
          ) : null}
        </View>
        <Pressable
          onPress={() => {
            setSuggested(undefined);
            setPortionOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Porsi ${portionLabel}. Ubah porsi`}
          hitSlop={12}
        >
          <AppText variant="subheadlineEmphasized" style={styles.underline}>
            {portionLabel}
          </AppText>
        </Pressable>
      </View>

      {result.loading ? (
        <View style={{ gap: spacing.m }} accessibilityLabel="Menilai kesesuaian">
          <Skeleton width="100%" height={116} style={{ borderRadius: radius.verdict }} />
          <Skeleton width="60%" height={20} />
          <Skeleton width="100%" height={70} />
          <Skeleton width="100%" height={70} />
        </View>
      ) : result.error ? (
        <Banner
          type={result.error.kind === 'OFFLINE' ? 'offline' : 'partnerUnavailable'}
          title={result.error.kind === 'OFFLINE' ? 'Penilaian butuh koneksi internet' : 'Penilaian belum dapat dimuat'}
          message={errorMessage(result.error)}
          actionLabel="Coba lagi"
          onAction={result.reload}
        />
      ) : a ? (
        <>
          <Verdict assessment={a} />
          {a.evidence.length === 0 ? (
            <Pressable
              onPress={() => nav.navigate('Main', { screen: 'ProfileTab', params: { screen: 'Preferences' } })}
              accessibilityRole="link"
            >
              <AppText variant="subheadlineEmphasized">Atur Profil Preferensi</AppText>
            </Pressable>
          ) : (
            <>
              <View style={styles.evidenceHeader}>
                <AppText variant="headline" accessibilityRole="header">
                  Bukti yang digunakan
                </AppText>
                <StatusChip status={completenessChip[a.completeness]} />
              </View>
              {a.evidence.map((e, i) => (
                <EvidenceRow key={`${e.rule}-${i}`} item={e} />
              ))}
            </>
          )}
          {a.outcome === 'KURANG_COCOK' ? (
            <Pressable
              onPress={() => {
                const r = addToCompare(productId);
                if (r === 'LIMIT') toast({ message: 'Perbandingan sudah penuh (maks. 3). Hapus salah satu dulu.' });
                nav.navigate('Main', { screen: 'ProductTab', params: { screen: 'Compare' } });
              }}
              accessibilityRole="link"
              style={styles.compareLink}
            >
              <Icon name="compare" size={18} />
              <AppText variant="subheadlineEmphasized">Bandingkan dengan produk lain</AppText>
            </Pressable>
          ) : null}
          <AppText variant="caption1" tone="secondary">
            {DISCLAIMER}
          </AppText>
        </>
      ) : null}
    </Screen>
  );
}

function verdictLabel(a: Assessment) {
  return a.outcome === 'COCOK' ? 'Cocok' : a.outcome === 'KURANG_COCOK' ? 'Kurang Cocok' : 'Belum Dapat Dinilai';
}

function Verdict({ assessment }: { assessment: Assessment }) {
  const kind = assessment.outcome;
  const surface =
    kind === 'COCOK'
      ? { backgroundColor: colors.stateSuccess2 }
      : kind === 'KURANG_COCOK'
        ? { backgroundColor: colors.neutralOrangeGray }
        : { borderWidth: 1.5, borderStyle: 'dashed' as const, borderColor: colors.labelSecondary };
  const icon = kind === 'COCOK' ? 'check-circle' : kind === 'KURANG_COCOK' ? 'alert' : 'help';
  return (
    <View style={[styles.verdict, surface]} accessible accessibilityRole="summary" accessibilityLabel={`${verdictLabel(assessment)}. ${assessment.summary}`}>
      <View style={styles.verdictTitle}>
        <Icon name={icon} size={32} color={kind === 'COCOK' ? colors.stateSuccess1 : colors.labelPrimary} />
        <AppText variant="title1" style={styles.flex}>
          {verdictLabel(assessment)}
        </AppText>
      </View>
      <AppText variant="subheadline">{assessment.summary}</AppText>
    </View>
  );
}

function EvidenceRow({ item }: { item: EvidenceItem }) {
  const icon = item.result === 'MET' ? 'check-circle' : item.result === 'VIOLATED' ? 'alert' : 'minus-circle';
  const source = item.source === 'PREFERENCE' ? 'Profil Preferensi Anda' : 'Nutrition Plan, Ambatufit';
  const observed = item.observed ?? `${item.nutrientLabel ?? 'Nilai'} tidak tersedia`;
  return (
    <View style={styles.evidence} accessible accessibilityLabel={`${item.rule}. Sumber: ${source}. ${observed}. ${item.resultLabel}`}>
      <Icon name={icon} size={22} color={item.result === 'MET' ? colors.stateSuccess1 : colors.labelPrimary} />
      <View style={styles.flex}>
        <AppText variant="subheadlineEmphasized">{item.rule}</AppText>
        <AppText variant="caption1" tone="secondary">
          {source}
        </AppText>
        <View style={styles.observed}>
          <AppText variant={item.observed ? 'footnote' : 'footnoteItalic'} tone={item.observed ? 'primary' : 'secondary'}>
            {observed}
          </AppText>
          <AppText variant="footnoteEmphasized"> · {item.resultLabel}</AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  underline: { textDecorationLine: 'underline' },
  assessedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingBottom: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
  },
  verdict: { borderRadius: radius.verdict, padding: spacing.l, gap: spacing.s },
  verdictTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  evidenceHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, flexWrap: 'wrap' },
  evidence: {
    flexDirection: 'row',
    gap: spacing.m,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.labelQuaternary,
    alignItems: 'flex-start',
  },
  observed: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingTop: spacing.xs },
  compareLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingTop: spacing.xs, minHeight: 44 },
});

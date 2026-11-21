/**
 * G1 Bandingkan 3 produk · G3 satuan berbeda (g vs ml). (G2 = CompareLimitSheet.)
 * Basis setara per 100 g / 100 ml. Unknown = "Tidak tersedia" (bukan 0/kosong).
 * Tanpa pemenang, peringkat, atau skor.
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { ProductStackParamList } from '../../app/navigation/types';
import { useRootNav } from '../../app/navigation/types';
import {
  AppText,
  Banner,
  Button,
  Icon,
  InfoNote,
  Screen,
  Skeleton,
  StatusChip,
  Tile,
  TopAppBar,
  outcomeChip,
  useToast,
} from '../../shared/components';
import { NUTRIENT_LABEL, basisUnit } from '../../shared/domain/nutrients';
import type { AssessmentOutcome, ComparisonColumn, FoodBasis, NutrientKey } from '../../shared/domain/types';
import { useCatalogLocal } from '../../shared/state/CatalogLocalProvider';
import { useAsync } from '../../shared/state/useAsync';
import { colors, radius, spacing } from '../../shared/theme';
import { formatNutrient } from '../../shared/utils/format';
import { assessmentService } from '../../services/assessment';

/** Metrik kunci (sisanya disembunyikan agar tabel mudah dipindai). */
const ROWS: NutrientKey[] = ['energy', 'protein', 'sugar', 'sodium'];
const LABEL_W = 86;

export function CompareScreen() {
  const nav = useNavigation<NativeStackNavigationProp<ProductStackParamList>>();
  const root = useRootNav();
  const toast = useToast();
  const { compareIds, removeFromCompare, setCompare } = useCatalogLocal();
  const { fontScale } = useWindowDimensions();
  const cols = useAsync(() => assessmentService.compare(compareIds), [compareIds.join(',')]);
  const data = cols.data ?? [];

  const counts = data.reduce<Record<FoodBasis, number>>((acc, c) => ({ ...acc, [c.basis]: acc[c.basis] + 1 }), { MASS: 0, VOLUME: 0 });
  const majority: FoodBasis = counts.VOLUME > counts.MASS ? 'VOLUME' : 'MASS';
  const mixed = counts.MASS > 0 && counts.VOLUME > 0;
  const odd = data.filter((c) => c.basis !== majority);

  const separate = () => {
    setCompare(data.filter((c) => c.basis === majority).map((c) => c.productId));
    toast({ message: `${odd.length} produk ${majority === 'MASS' ? 'cair' : 'padat'} dipisahkan dari perbandingan` });
  };

  return (
    <Screen inTabs gap={spacing.m}>
      <TopAppBar
        onLeading={() => nav.goBack()}
        title="Bandingkan produk"
        actions={compareIds.length < 3 ? [{ icon: 'plus', label: 'Tambah produk', onPress: () => nav.navigate('SearchResults', { query: '' }) }] : []}
      />

      {cols.loading ? (
        <Skeleton width="100%" height={300} />
      ) : cols.error ? (
        <Banner type="partnerUnavailable" title="Perbandingan belum dapat dimuat" actionLabel="Coba lagi" onAction={cols.reload} />
      ) : data.length === 0 ? (
        <View style={{ gap: spacing.m }}>
          <AppText variant="title2">Belum ada produk untuk dibandingkan</AppText>
          <AppText variant="subheadline" tone="secondary">
            Ketuk ikon bandingkan di halaman produk untuk menambahkan hingga 3 produk.
          </AppText>
          <Button label="Cari produk" icon="search" onPress={() => nav.navigate('SearchResults', { query: '' })} />
        </View>
      ) : (
        <>
          {mixed ? (
            <View style={styles.warning} accessibilityRole="alert">
              <Icon name="alert" size={20} />
              <View style={styles.flex}>
                <AppText variant="subheadlineEmphasized">Satuan tidak setara</AppText>
                <AppText variant="footnote">
                  {odd.map((c) => c.name.split(' ').slice(0, 2).join(' ')).join(', ')} diukur per 100 {basisUnit(odd[0].basis)}, produk lain per 100{' '}
                  {basisUnit(majority)}. Nilainya ditampilkan, tetapi tidak dibandingkan langsung.
                </AppText>
              </View>
            </View>
          ) : (
            <InfoNote tone="greenGray" style={{ paddingVertical: 10 }}>
              <AppText variant="footnoteEmphasized">
                Dibandingkan per 100 {basisUnit(majority)}, semua produk {majority === 'MASS' ? 'padat' : 'cair'}
              </AppText>
            </InfoNote>
          )}

          {fontScale >= 1.3 ? (
            data.map((c) => <CompareCard key={c.productId} col={c} muted={mixed && c.basis !== majority} onRemove={() => removeFromCompare(c.productId)} />)
          ) : (
            <CompareTable data={data} majority={majority} mixed={mixed} onRemove={removeFromCompare} onOpen={(id) => root.navigate('ProductDetail', { productId: id })} />
          )}

          {data.length === 1 ? (
            <AppText variant="footnote" tone="secondary">
              Tambahkan produk lain untuk mulai membandingkan.
            </AppText>
          ) : null}

          {mixed ? (
            <Button label={`Pisahkan produk ${majority === 'MASS' ? 'cair' : 'padat'}`} icon="compare" type="secondary" onPress={separate} />
          ) : null}
        </>
      )}
    </Screen>
  );
}

function CompareTable({
  data,
  majority,
  mixed,
  onRemove,
  onOpen,
}: {
  data: ComparisonColumn[];
  majority: FoodBasis;
  mixed: boolean;
  onRemove: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const tint = (c: ComparisonColumn) => (mixed && c.basis !== majority ? { backgroundColor: colors.neutralYellowGray } : null);
  return (
    <View accessibilityRole="none">
      {/* Header kolom */}
      <View style={[styles.row, styles.headerRow]}>
        <View style={{ width: LABEL_W }} />
        {data.map((c) => (
          <View key={c.productId} style={[styles.col, styles.colHeader]}>
            <View style={styles.colTop}>
              <Pressable onPress={() => onOpen(c.productId)} accessibilityRole="button" accessibilityLabel={`Buka ${c.name}`}>
                <Tile tone={c.source === 'USER_ENTERED' ? 'user' : 'neutral'} />
              </Pressable>
              <Pressable
                onPress={() => onRemove(c.productId)}
                accessibilityRole="button"
                accessibilityLabel={`Hapus ${c.name} dari perbandingan`}
                hitSlop={6}
                style={styles.remove}
              >
                <Icon name="close" size={16} />
              </Pressable>
            </View>
            <AppText variant="footnoteEmphasized">{c.name}</AppText>
            <AppText variant="caption2" tone="secondary">
              {mixed ? `per 100 ${basisUnit(c.basis)}` : c.brand}
            </AppText>
          </View>
        ))}
      </View>

      {ROWS.map((k) => (
        <View key={k} style={[styles.row, styles.dataRow]}>
          <View style={[styles.label, { width: LABEL_W }]}>
            <AppText variant="footnote">{NUTRIENT_LABEL[k]}</AppText>
          </View>
          {data.map((c) => {
            const v = c.values[k];
            const muted = mixed && c.basis !== majority;
            return (
              <View
                key={c.productId}
                style={[styles.col, styles.cell, tint(c)]}
                accessible
                accessibilityLabel={`${NUTRIENT_LABEL[k]}, ${c.name}: ${v === null ? 'tidak tersedia' : formatNutrient(k, v)} per 100 ${basisUnit(c.basis)}`}
              >
                {v === null ? (
                  <AppText variant="caption1Italic" tone="secondary" align="right">
                    Tidak tersedia
                  </AppText>
                ) : (
                  <AppText variant="subheadlineEmphasized" tone={muted ? 'secondary' : 'primary'} align="right">
                    {formatNutrient(k, v)}
                  </AppText>
                )}
              </View>
            );
          })}
        </View>
      ))}

      {!mixed ? (
        <View style={[styles.row, styles.dataRow]}>
          <View style={[styles.label, { width: LABEL_W }]}>
            <AppText variant="footnote">Penilaian</AppText>
          </View>
          {data.map((c) => (
            <View key={c.productId} style={[styles.col, styles.cell]}>
              <MiniChip outcome={c.outcome} />
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.row, styles.dataRow]}>
        <View style={[styles.label, { width: LABEL_W }]}>
          <AppText variant="footnote">Data</AppText>
        </View>
        {data.map((c) => (
          <View key={c.productId} style={[styles.col, styles.cell, tint(c)]}>
            <AppText variant="caption1Emphasized" align="right">
              {c.source === 'USER_ENTERED' ? 'Belum diverifikasi' : c.completeness === 'COMPLETE' ? 'Lengkap' : 'Tidak lengkap'}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function MiniChip({ outcome }: { outcome?: AssessmentOutcome }) {
  const o = outcome ?? 'BELUM_DAPAT_DINILAI';
  const surface =
    o === 'COCOK'
      ? { backgroundColor: colors.stateSuccess2 }
      : o === 'KURANG_COCOK'
        ? { backgroundColor: colors.neutralOrangeGray }
        : { borderWidth: 1, borderStyle: 'dashed' as const, borderColor: colors.labelSecondary };
  const label = o === 'COCOK' ? 'Cocok' : o === 'KURANG_COCOK' ? 'Kurang cocok' : 'Belum dinilai';
  const icon = o === 'COCOK' ? 'check-circle' : o === 'KURANG_COCOK' ? 'alert' : 'help';
  return (
    <View style={[styles.mini, surface]} accessible accessibilityLabel={outcomeChip[o]}>
      <Icon name={icon} size={14} color={o === 'COCOK' ? colors.stateSuccess1 : colors.labelPrimary} />
      <AppText variant="caption2Emphasized" align="right">
        {label}
      </AppText>
    </View>
  );
}

/** Mode teks ≥130%: kolom menjadi kartu per produk. */
function CompareCard({ col, muted, onRemove }: { col: ComparisonColumn; muted: boolean; onRemove: () => void }) {
  return (
    <View style={[styles.card, muted && { backgroundColor: colors.neutralYellowGray }]}>
      <View style={styles.cardHeader}>
        <AppText variant="headline" style={styles.flex}>
          {col.name}
        </AppText>
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Hapus ${col.name} dari perbandingan`} hitSlop={8}>
          <Icon name="close" size={20} />
        </Pressable>
      </View>
      <AppText variant="footnote" tone="secondary">
        per 100 {basisUnit(col.basis)}
      </AppText>
      {ROWS.map((k) => (
        <View key={k} style={styles.cardRow}>
          <AppText variant="body">{NUTRIENT_LABEL[k]}</AppText>
          {col.values[k] === null ? (
            <AppText variant="footnoteItalic" tone="secondary">
              Tidak tersedia
            </AppText>
          ) : (
            <AppText variant="headline">{formatNutrient(k, col.values[k] as number)}</AppText>
          )}
        </View>
      ))}
      {col.outcome && !muted ? <StatusChip status={outcomeChip[col.outcome]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  warning: { flexDirection: 'row', gap: 10, padding: spacing.m, borderRadius: radius.surface, backgroundColor: colors.neutralOrangeGray },
  row: { flexDirection: 'row' },
  headerRow: { paddingBottom: spacing.s, borderBottomWidth: 1, borderBottomColor: colors.labelPrimary },
  dataRow: { borderBottomWidth: 1, borderBottomColor: colors.labelQuaternary, alignItems: 'stretch' },
  label: { paddingVertical: 10, justifyContent: 'center' },
  col: { flex: 1, paddingHorizontal: spacing.xs },
  colHeader: { gap: spacing.xs },
  colTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  remove: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cell: { paddingVertical: 10, alignItems: 'flex-end', justifyContent: 'center' },
  mini: { borderRadius: radius.chip, paddingVertical: spacing.xs, paddingHorizontal: 6, gap: 2, alignItems: 'flex-end' },
  card: { borderWidth: 1, borderColor: colors.labelQuaternary, borderRadius: radius.surface, padding: spacing.l, gap: spacing.s },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.s, flexWrap: 'wrap' },
});

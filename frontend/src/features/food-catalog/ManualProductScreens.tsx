/**
 * 05. Produk Manual — E1 formulir, E2 validasi, E3 tinjau. (E4 = ProductDetailScreen.)
 * Hanya nama wajib (PROPOSED). Kosong = tidak diketahui ("Tidak tersedia"); 0 hanya bila label menulis 0.
 * Validasi hanya kewajaran input (wajib nama, angka ≥ 0) — tidak ada ambang gizi di sini.
 */
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { useRootNav } from '../../app/navigation/types';
import { errorMessage, toAppError } from '../../shared/api/errors';
import {
  ActionBar,
  AppText,
  Banner,
  Button,
  Dialog,
  Icon,
  InfoNote,
  NutrientRow,
  NutritionTableHeader,
  Screen,
  SegmentedControl,
  StatusChip,
  TextField,
  Tile,
  TopAppBar,
  completenessChip,
  useToast,
} from '../../shared/components';
import { NUTRIENT_LABEL, NUTRIENT_UNIT, basisUnit, emptyFacts } from '../../shared/domain/nutrients';
import type { FoodBasis, ManualProductInput, NutrientKey } from '../../shared/domain/types';
import { useCatalogLocal } from '../../shared/state/CatalogLocalProvider';
import { colors, radius, spacing } from '../../shared/theme';
import { formatNumber, parseDecimal, toInputText } from '../../shared/utils/format';
import { catalogService } from '../../services/catalog';

/** Mengikuti set nutrien baseline; tidak menambah field di luar metrik baseline. */
const FIELDS: NutrientKey[] = ['energy', 'fat', 'protein', 'carbohydrate', 'sugar', 'sodium'];

type Values = Record<NutrientKey, string>;

/* ------------------------------ E1 / E2 ------------------------------ */

export function ManualProductFormScreen({
  route,
}: {
  route: { params?: { barcode?: string; name?: string; productId?: string } };
}) {
  const nav = useRootNav();
  const toast = useToast();
  const params = route.params ?? {};
  const editing = !!params.productId;

  const [name, setName] = useState(params.name ?? '');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState(params.barcode ?? '');
  const [basis, setBasis] = useState<FoodBasis>('MASS');
  const [serving, setServing] = useState('');
  const [values, setValues] = useState<Values>(() => Object.fromEntries(FIELDS.map((k) => [k, ''])) as Values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Mode ubah: isi dari produk pribadi yang ada.
  useEffect(() => {
    if (!params.productId) return;
    void catalogService.getProduct(params.productId).then((p) => {
      setName(p.name);
      setBrand(p.brand ?? '');
      setBarcode(p.barcode ?? '');
      setBasis(p.basis);
      setServing(toInputText(p.serving?.quantity));
      setValues(Object.fromEntries(FIELDS.map((k) => [k, toInputText(p.nutrientsPer100[k])])) as Values);
    });
  }, [params.productId]);

  const unit = basisUnit(basis);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Nama produk wajib diisi agar mudah ditemukan lagi.';
    for (const k of FIELDS) {
      const v = parseDecimal(values[k]);
      if (v !== null && Number.isNaN(v)) e[k] = 'Masukkan angka, contoh 12,5.';
      else if (v !== null && v < 0) e[k] = 'Nilai tidak boleh negatif.';
    }
    const s = parseDecimal(serving);
    if (s !== null && (Number.isNaN(s) || s <= 0)) e.serving = 'Ukuran sajian harus angka lebih dari 0.';
    setErrors(e);
    return e;
  };

  const review = () => {
    setSubmitted(true);
    const e = validate();
    const count = Object.keys(e).length;
    if (count > 0) {
      AccessibilityInfo.announceForAccessibility(`${count} isian perlu diperbaiki sebelum melanjutkan.`);
      return;
    }
    const facts: Partial<Record<NutrientKey, number | null>> = {};
    for (const k of FIELDS) facts[k] = parseDecimal(values[k]);
    const s = parseDecimal(serving);
    const input: ManualProductInput = {
      name: name.trim(),
      brand: brand.trim() || undefined,
      barcode: barcode.trim() || undefined,
      basis,
      serving: s ? { quantity: s, unit } : undefined,
      nutrientsPer100: facts,
    };
    nav.navigate('ManualProductReview', { input, productId: params.productId });
  };

  const remove = async () => {
    if (!params.productId) return;
    setDeleting(true);
    try {
      await catalogService.deleteManualProduct(params.productId);
      setConfirmDelete(false);
      toast({ message: 'Produk dihapus' });
      nav.popToTop();
    } catch (e) {
      setConfirmDelete(false);
      toast({ message: errorMessage(e) });
    } finally {
      setDeleting(false);
    }
  };

  const errorCount = Object.keys(errors).length;
  const setValue = (k: NutrientKey, t: string) => {
    setValues((v) => ({ ...v, [k]: t.replace(/[^0-9,.\-]/g, '') }));
    if (submitted) setErrors(({ [k]: _omit, ...rest }) => rest);
  };

  return (
    <Screen
      gap={spacing.l}
      keyboard
      actionBar={
        <ActionBar>
          <Button label="Tinjau" onPress={review} />
        </ActionBar>
      }
      overlay={
        <Dialog
          visible={confirmDelete}
          title={`Hapus “${name}”?`}
          message="Produk pribadi ini akan dihapus. Catatan Konsumsi yang sudah memakainya tetap menyimpan salinan gizinya."
          onDismiss={() => setConfirmDelete(false)}
        >
          <Button label="Hapus produk" icon="trash" type="destructive" onPress={remove} loading={deleting} />
          <Button label="Batal" type="tertiary" onPress={() => setConfirmDelete(false)} />
        </Dialog>
      }
    >
      <TopAppBar leading="close" onLeading={() => nav.goBack()} title={editing ? 'Ubah produk' : 'Tambah produk'} />

      {errorCount > 0 ? (
        <View style={styles.errorSummary} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          <Icon name="alert" size={20} />
          <AppText variant="subheadlineEmphasized" style={styles.flex}>
            {errorCount} isian perlu diperbaiki sebelum melanjutkan.
          </AppText>
        </View>
      ) : null}

      <TextField
        label="Nama produk"
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (submitted && t.trim()) setErrors(({ name: _n, ...rest }) => rest);
        }}
        error={errors.name}
        autoFocus={!name}
        returnKeyType="next"
      />
      <View style={styles.row12}>
        <TextField label="Merek (opsional)" value={brand} onChangeText={setBrand} style={styles.flex} />
        <TextField
          label="Barcode"
          value={barcode}
          onChangeText={(t) => setBarcode(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          disabled={!!params.barcode}
          placeholder="Opsional"
          style={styles.flex}
        />
      </View>
      <View style={{ gap: 6 }}>
        <AppText variant="footnoteEmphasized">Bentuk produk</AppText>
        <SegmentedControl
          accessibilityLabel="Bentuk produk"
          options={[
            { value: 'MASS', label: 'Padat, g' },
            { value: 'VOLUME', label: 'Cair, ml' },
          ]}
          value={basis}
          onChange={setBasis}
        />
      </View>
      <TextField
        label="Ukuran sajian (opsional)"
        value={serving}
        onChangeText={(t) => setServing(t.replace(/[^0-9,.]/g, ''))}
        unit={unit}
        keyboardType="decimal-pad"
        error={errors.serving}
      />

      <View style={styles.nutrition}>
        <AppText variant="title2" accessibilityRole="header">
          Nilai gizi per 100 {unit}
        </AppText>
        <InfoNote>
          Kosongkan jika tidak tercantum di label, akan tercatat “Tidak tersedia”. Isi 0 hanya bila label menulis 0.
        </InfoNote>
        <View style={styles.grid}>
          {FIELDS.map((k) => {
            const v = parseDecimal(values[k]);
            return (
              <TextField
                key={k}
                label={NUTRIENT_LABEL[k]}
                value={values[k]}
                onChangeText={(t) => setValue(k, t)}
                unit={NUTRIENT_UNIT[k]}
                keyboardType="decimal-pad"
                error={errors[k]}
                helper={v === 0 ? `Tercatat 0 ${NUTRIENT_UNIT[k]}` : undefined}
                style={styles.gridItem}
              />
            );
          })}
        </View>
      </View>

      {editing ? (
        <Pressable onPress={() => setConfirmDelete(true)} accessibilityRole="button" style={styles.deleteLink} hitSlop={8}>
          <Icon name="trash" size={18} color={colors.stateError} />
          <AppText variant="subheadlineEmphasized" tone="error">
            Hapus produk
          </AppText>
        </Pressable>
      ) : null}
    </Screen>
  );
}

/* ------------------------------ E3 ------------------------------ */

export function ManualProductReviewScreen({ route }: { route: { params: { input: ManualProductInput; productId?: string } } }) {
  const nav = useRootNav();
  const toast = useToast();
  const { rememberProduct } = useCatalogLocal();
  const { input, productId } = route.params;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const facts = { ...emptyFacts(), ...input.nutrientsPer100 };
  const unit = basisUnit(input.basis);
  const missing = FIELDS.filter((k) => facts[k] === null).length;
  const completeness = missing === 0 ? 'COMPLETE' : missing === FIELDS.length ? 'INSUFFICIENT' : 'INCOMPLETE';

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const p = productId
        ? await catalogService.updateManualProduct(productId, input)
        : await catalogService.createManualProduct(input);
      rememberProduct(p);
      toast({ message: 'Produk tersimpan' });
      nav.popToTop();
      nav.navigate('ProductDetail', { productId: p.id });
    } catch (e) {
      const err = toAppError(e);
      setError(err.kind === 'OFFLINE' ? 'Menyimpan produk baru butuh koneksi internet. Isian Anda tidak hilang; coba lagi saat online.' : errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      gap={14}
      actionBar={
        <ActionBar>
          <Button label="Simpan produk" onPress={save} loading={saving} />
          <Button label="Ubah isian" type="tertiary" onPress={() => nav.goBack()} />
        </ActionBar>
      }
    >
      <TopAppBar onLeading={() => nav.goBack()} title="Tinjau sebelum menyimpan" />
      {error ? <Banner type="offline" title="Belum tersimpan" message={error} /> : null}
      <View style={styles.headerRow}>
        <Tile tone="user" />
        <View style={styles.flex}>
          <AppText variant="title2">{input.name}</AppText>
          <AppText variant="subheadline" tone="secondary">
            {[input.brand, input.barcode].filter(Boolean).join(', ') || 'Tanpa merek'}
            {input.serving ? ` (${formatNumber(input.serving.quantity)} ${unit})` : ''}
          </AppText>
        </View>
      </View>
      <View style={styles.chips}>
        <StatusChip status="Belum diverifikasi" />
        <StatusChip status={completenessChip[completeness]} />
      </View>
      <View>
        <NutritionTableHeader columns={[`Per 100 ${unit}`]} />
        {FIELDS.map((k, i) => (
          <NutrientRow key={k} nutrient={k} valueA={facts[k]} last={i === FIELDS.length - 1} />
        ))}
      </View>
      <InfoNote icon="lock">Disimpan sebagai produk pribadi. Tidak dibagikan ke katalog umum.</InfoNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row12: { flexDirection: 'row', gap: spacing.m, alignItems: 'flex-start' },
  nutrition: { gap: spacing.m, paddingTop: spacing.m, borderTopWidth: 1, borderTopColor: colors.labelQuaternary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.m },
  gridItem: { flexBasis: '45%', flexGrow: 1 },
  errorSummary: {
    flexDirection: 'row',
    gap: 10,
    padding: spacing.m,
    borderRadius: radius.surface,
    borderWidth: 1.5,
    borderColor: colors.stateError,
    alignItems: 'center',
  },
  headerRow: { flexDirection: 'row', gap: spacing.m, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  deleteLink: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-start', paddingTop: spacing.s, minHeight: 44 },
});

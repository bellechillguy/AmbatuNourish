/**
 * F1: Pilih porsi (bottom sheet). Satuan terkunci pada bentuk produk: g (padat) / ml (cair).
 * Preset sajian hanya bila ukuran sajian tersedia dan konversinya valid; tidak pernah g↔ml.
 * Dipakai ulang oleh penilaian, catat konsumsi, dan ubah porsi item favorit.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet, Button, FilterChip, InfoNote, TextField } from '../../shared/components';
import { basisUnit } from '../../shared/domain/nutrients';
import type { FoodBasis, ServingSize } from '../../shared/domain/types';
import { spacing } from '../../shared/theme';
import { formatNumber, parseDecimal, toInputText } from '../../shared/utils/format';

interface PortionSheetProps {
  visible: boolean;
  onClose: () => void;
  basis: FoodBasis;
  serving?: ServingSize;
  initialQuantity?: number;
  submitLabel?: string;
  title?: string;
  onSubmit: (quantity: number) => void;
}

export function portionPresets(basis: FoodBasis, serving?: ServingSize) {
  const unit = basisUnit(basis);
  const presets: { label: string; quantity: number }[] = [];
  // Preset sajian hanya bila satuan sajian sama dengan satuan kanonik (konversi valid).
  if (serving && serving.unit === unit) {
    presets.push({ label: `1 sajian (${formatNumber(serving.quantity)} ${unit})`, quantity: serving.quantity });
    presets.push({ label: `½ sajian (${formatNumber(serving.quantity / 2)} ${unit})`, quantity: serving.quantity / 2 });
  }
  if (!presets.some((p) => p.quantity === 100)) presets.push({ label: `100 ${unit}`, quantity: 100 });
  return presets;
}

export function validateQuantity(text: string): { value: number | null; error: string | null } {
  const v = parseDecimal(text);
  if (v === null) return { value: null, error: 'Masukkan jumlah porsi.' };
  if (Number.isNaN(v)) return { value: null, error: 'Masukkan angka, contoh 150 atau 12,5.' };
  if (v <= 0) return { value: null, error: 'Jumlah harus lebih dari 0.' };
  return { value: v, error: null };
}

export function PortionSheet({
  visible,
  onClose,
  basis,
  serving,
  initialQuantity,
  submitLabel = 'Nilai kesesuaian',
  title = 'Berapa porsinya?',
  onSubmit,
}: PortionSheetProps) {
  const unit = basisUnit(basis);
  const presets = portionPresets(basis, serving);
  const defaultQty = initialQuantity ?? (serving && serving.unit === unit ? serving.quantity : undefined);
  const [text, setText] = useState(toInputText(defaultQty));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setText(toInputText(defaultQty));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const current = parseDecimal(text);

  const submit = () => {
    const { value, error: e } = validateQuantity(text);
    setError(e);
    if (value !== null) onSubmit(value);
  };

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <View style={styles.presets}>
        {presets.map((p) => (
          <FilterChip
            key={p.label}
            label={p.label}
            selected={current === p.quantity}
            onPress={() => {
              setText(toInputText(p.quantity));
              setError(null);
            }}
          />
        ))}
      </View>
      <TextField
        label={unit === 'ml' ? 'Jumlah yang diminum' : 'Jumlah yang dimakan'}
        value={text}
        onChangeText={(t) => {
          setText(t.replace(/[^0-9,.]/g, ''));
          setError(null);
        }}
        unit={unit}
        keyboardType="decimal-pad"
        helper={`Satuan mengikuti produk ${unit === 'ml' ? 'cair (ml)' : 'padat (g)'}.`}
        error={error}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <InfoNote>Pilihan “sajian” hanya muncul bila ukuran sajian tercantum di data produk.</InfoNote>
      <Button label={submitLabel} onPress={submit} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
});

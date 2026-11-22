/** G2: Batas perbandingan tercapai — ganti salah satu produk, tanpa error buntu. */
import React, { useEffect, useState } from 'react';

import { AppText, BottomSheet, Button, RadioRow } from '../../shared/components';
import type { ComparisonColumn } from '../../shared/domain/types';
import { useCatalogLocal } from '../../shared/state/CatalogLocalProvider';
import { assessmentService } from '../../services/assessment';

export function CompareLimitSheet({
  visible,
  newProductId,
  newProductName,
  onClose,
  onReplaced,
}: {
  visible: boolean;
  newProductId: string;
  newProductName: string;
  onClose: () => void;
  onReplaced: () => void;
}) {
  const { compareIds, replaceInCompare } = useCatalogLocal();
  const [columns, setColumns] = useState<ComparisonColumn[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    void assessmentService.compare(compareIds).then((c) => {
      setColumns(c);
      setSelected(c[0]?.productId ?? null);
    });
  }, [visible, compareIds]);

  return (
    <BottomSheet visible={visible} title="Perbandingan sudah penuh" onClose={onClose}>
      <AppText variant="subheadline" tone="secondary">
        Perbandingan memuat maksimal 3 produk. Pilih produk yang ingin diganti dengan “{newProductName}”.
      </AppText>
      <>
        {columns.map((c) => (
          <RadioRow key={c.productId} label={c.name} selected={selected === c.productId} onPress={() => setSelected(c.productId)} />
        ))}
      </>
      <Button
        label="Ganti produk"
        disabled={!selected}
        onPress={() => {
          if (!selected) return;
          replaceInCompare(selected, newProductId);
          onReplaced();
        }}
      />
      <Button label="Batal" type="tertiary" onPress={onClose} />
    </BottomSheet>
  );
}

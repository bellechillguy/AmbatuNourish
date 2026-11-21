import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable } from 'react-native';

import { AppText, TextField } from '../../shared/components';

/**
 * Field tanggal/jam memakai picker native per platform (frame field tetap komponen bersama).
 * Picker membatasi masa depan (maximumDate = sekarang); input yang lolos tetap divalidasi (K2).
 */
export function DateTimePickerField({
  label,
  mode,
  value,
  display,
  onChange,
  maximumDate,
  error,
  style,
}: {
  label: string;
  mode: 'date' | 'time';
  value: Date;
  display: string;
  onChange: (d: Date) => void;
  maximumDate?: Date;
  error?: string | null;
  style?: object;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TextField label={label} value={display} onPressField={() => setOpen(true)} error={error} style={style} />
      {open && Platform.OS === 'ios' ? (
        <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={{ alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="subheadlineEmphasized">Selesai</AppText>
        </Pressable>
      ) : null}
      {open ? (
        <DateTimePicker
          value={value}
          mode={mode}
          is24Hour
          locale="id-ID"
          maximumDate={mode === 'date' ? maximumDate : undefined}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event: { type: string }, d?: Date) => {
            if (Platform.OS !== 'ios') setOpen(false);
            if (event.type === 'set' && d) onChange(d);
            if (event.type === 'dismissed') setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

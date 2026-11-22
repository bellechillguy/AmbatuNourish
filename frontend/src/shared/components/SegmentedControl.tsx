import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MIN_TOUCH, colors, radius, spacing } from '../theme';
import { AppText } from './AppText';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}

/** Segmented Control — trek Green Gray, segmen terpilih putih dengan border tipis. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={o.label}
            style={[styles.segment, selected && styles.selected]}
          >
            <AppText variant={selected ? 'subheadlineEmphasized' : 'subheadline'} tone={selected ? 'primary' : 'secondary'}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.neutralYellowGray,
    borderRadius: radius.field,
    padding: 3,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selected: { backgroundColor: colors.neutralWhite, borderColor: colors.labelQuaternary },
});

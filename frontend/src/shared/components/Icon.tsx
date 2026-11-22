import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../theme';
import { iconPaths, type IconName } from './iconPaths';

export type { IconName } from './iconPaths';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Ikon dekoratif disembunyikan dari pembaca layar (default). */
  accessibilityLabel?: string;
}

/** icon/* — 24pt grid, stroke 1.75, round caps. Artwork identik di iOS & Android. */
export function Icon({ name, size = 24, color = colors.labelPrimary, accessibilityLabel }: IconProps) {
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };

  if (name === 'consumed') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...a11y}>
        <Circle cx={12} cy={12} r={9.5} fill={colors.brandGreen} />
        <Path
          d={iconPaths.consumed[0]}
          stroke={colors.neutralWhite}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...a11y}>
      {iconPaths[name].map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

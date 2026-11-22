import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useUiPrefs } from '../shared/state/PreferencesUiProvider';
import { colors } from '../shared/theme';
import { SplashGlow, SplashWordmark } from './SplashArtwork';

const MIN_VISIBLE_MS = 1500;
const FADE_MS = 350;
// Welcome frame 139:3445 and its exported blur layers, including their outsets.
const FRAME_WIDTH = 412;
const FRAME_HEIGHT = 917;
const EDGE_SIZE = 1000;
const EDGE_OFFSET = 670;

export function LaunchSplash({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const { width, height } = useWindowDimensions();
  const { reduceMotion } = useUiPrefs();
  const [opacity] = useState(() => new Animated.Value(1));
  const [laidOut, setLaidOut] = useState(false);
  const [shownAt, setShownAt] = useState<number | null>(null);
  const scale = Math.min(width / FRAME_WIDTH, height / FRAME_HEIGHT, 1.15);
  const edgeSize = EDGE_SIZE * scale;
  const edgeOffset = -EDGE_OFFSET * scale;

  useEffect(() => {
    if (!laidOut) return;
    void SplashScreen.hideAsync();
    setShownAt(Date.now());
  }, [laidOut]);

  useEffect(() => {
    if (!ready || shownAt === null) return;
    let fade: Animated.CompositeAnimation | undefined;
    const timer = setTimeout(() => {
      if (reduceMotion) {
        onFinish();
        return;
      }
      fade = Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: Platform.OS !== 'web' });
      fade.start(({ finished }) => {
        if (finished) onFinish();
      });
    }, Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt)));

    return () => {
      clearTimeout(timer);
      fade?.stop();
    };
  }, [onFinish, opacity, ready, reduceMotion, shownAt]);

  return (
    <Animated.View
      accessible
      accessibilityLabel="AmbatuNourish sedang dimuat"
      accessibilityViewIsModal
      onLayout={() => setLaidOut(true)}
      style={[styles.splash, { opacity }]}
    >
      <View style={[styles.edge, { top: edgeOffset }]}>
        <SplashGlow edge="top" size={edgeSize} />
      </View>
      <View style={[styles.edge, styles.flippedEdge, { bottom: edgeOffset }]}>
        <SplashGlow edge="bottom" size={edgeSize} />
      </View>
      <SplashWordmark scale={scale} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.neutralWhite,
  },
  edge: { position: 'absolute', alignSelf: 'center' },
  flippedEdge: { transform: [{ rotate: '180deg' }] },
});

import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useThemeColors } from '@/lib/theme';

// Último punto de la barra que se ha enseñado: el paso siguiente anima desde ahí.
let shownProgress = 0;
const DOT = 14;
const PROGRESS_MS = 650;

/**
 * Barra de pasos. Lo ya hecho es barra rellena; el paso actual, una bolita de color (más
 * grande), y los que faltan, bolitas huecas. Al completar un paso la barra avanza hasta el
 * siguiente: la bolita que se deja se funde en la barra y la nueva se llena y crece. Todo se
 * anima en el hilo de la interfaz (Reanimated), sin ocupar JavaScript.
 */
export const Progress = memo(function Progress({
  index,
  total,
  style,
}: {
  index: number;
  total: number;
  style?: object;
}) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(Math.min(shownProgress, index));
  useEffect(() => {
    shownProgress = index;
    progress.value = withTiming(index, {
      duration: PROGRESS_MS,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [progress, index]);

  const last = Math.max(total - 1, 1);
  const track = Math.max(0, width - DOT);
  const fillStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, last], [0, track], 'clamp'),
  }));
  return (
    <View
      style={[styles.progress, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Paso ${Math.min(index + 1, total)} de ${total}`}
    >
      <View
        style={[styles.track, { left: DOT / 2, right: DOT / 2, backgroundColor: colors.border }]}
      />
      <Animated.View
        style={[
          styles.track,
          styles.trackFill,
          { left: DOT / 2, backgroundColor: colors.primary },
          fillStyle,
        ]}
      />
      {Array.from({ length: total }, (_, i) => (
        <Dot
          key={i}
          i={i}
          left={(i / last) * track}
          progress={progress}
          border={colors.border}
          primary={colors.primary}
          surface={colors.surface}
        />
      ))}
    </View>
  );
});

/** Una bolita: pendiente → actual (crece y se llena) → hecha (se funde en la barra). */
function Dot({
  i,
  left,
  progress,
  border,
  primary,
  surface,
}: {
  i: number;
  left: number;
  progress: SharedValue<number>;
  border: string;
  primary: string;
  surface: string;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      borderColor: interpolateColor(p, [i - 1, i], [border, primary]),
      backgroundColor: interpolateColor(p, [i - 1, i], [surface, primary]),
      opacity: interpolate(p, [i, i + 0.7], [1, 0], 'clamp'),
      transform: [{ scale: interpolate(p, [i - 1, i, i + 0.7], [0.75, 1.25, 0.3], 'clamp') }],
    };
  });
  return <Animated.View style={[styles.progressDot, { left }, style]} />;
}

const styles = StyleSheet.create({
  progress: { height: 14, justifyContent: 'center', alignSelf: 'stretch' },
  track: { position: 'absolute', height: 3, borderRadius: 2 },
  progressDot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
  },
  trackFill: { height: 4, borderRadius: 2 },
});

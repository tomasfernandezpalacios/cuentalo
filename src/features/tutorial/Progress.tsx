import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useThemeColors } from '@/lib/theme';

// Último punto de la barra que se ha enseñado: el paso siguiente anima desde ahí.
let shownProgress = 0;
const DOT = 14;
const PROGRESS_MS = 650;

/**
 * Barra de pasos. Lo ya hecho es barra rellena y el paso actual, una sola bolita de color al
 * final del relleno (petición del usuario: las bolitas de cada paso están «imaginadas», no se
 * dibujan todas porque salían muy pegadas). Al pasar de paso, la bolita avanza con el relleno.
 * Todo se anima en el hilo de la interfaz (Reanimated).
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
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, last], [0, track], 'clamp') }],
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
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: colors.primary, borderColor: colors.surface },
          dotStyle,
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  progress: { height: DOT, justifyContent: 'center', alignSelf: 'stretch' },
  track: { position: 'absolute', height: 3, borderRadius: 2 },
  trackFill: { height: 4, borderRadius: 2 },
  dot: {
    position: 'absolute',
    left: 0,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
  },
});

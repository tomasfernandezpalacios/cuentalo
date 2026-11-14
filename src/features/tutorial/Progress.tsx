import { memo, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/lib/theme';

// Último punto de la barra que se ha enseñado: el paso siguiente anima desde ahí.
let shownProgress = 0;
const DOT = 14;

/**
 * Barra de pasos. Lo ya hecho es barra rellena; el paso actual, una bolita de color (más
 * grande), y los que faltan, bolitas huecas. Al completar un paso la barra avanza hasta el
 * siguiente: la bolita que se deja se funde en la barra y la nueva se llena y crece.
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
  const [progress] = useState(() => new Animated.Value(Math.min(shownProgress, index)));
  useEffect(() => {
    shownProgress = index;
    Animated.timing(progress, {
      toValue: index,
      duration: 1100,
      delay: 200,
      easing: Easing.inOut(Easing.cubic),
      // Anima ancho y color: no se puede con el driver nativo.
      useNativeDriver: false,
    }).start();
  }, [progress, index]);

  const last = Math.max(total - 1, 1);
  const track = Math.max(0, width - DOT);
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
          {
            left: DOT / 2,
            backgroundColor: colors.primary,
            width: progress.interpolate({
              inputRange: [0, last],
              outputRange: [0, track],
              extrapolate: 'clamp',
            }),
          },
        ]}
      />
      {Array.from({ length: total }, (_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.progressDot,
            {
              width: DOT,
              height: DOT,
              borderRadius: DOT / 2,
              left: (i / last) * track,
              borderColor: progress.interpolate({
                inputRange: [i - 1, i],
                outputRange: [colors.border, colors.primary],
                extrapolate: 'clamp',
              }),
              backgroundColor: progress.interpolate({
                inputRange: [i - 1, i],
                outputRange: [colors.surface, colors.primary],
                extrapolate: 'clamp',
              }),
              // Pendiente → actual (crece) → hecho (se funde en la barra).
              opacity: progress.interpolate({
                inputRange: [i, i + 0.7],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  scale: progress.interpolate({
                    inputRange: [i - 1, i, i + 0.7],
                    outputRange: [0.75, 1.25, 0.3],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  progress: { height: 14, justifyContent: 'center', alignSelf: 'stretch' },
  track: { position: 'absolute', height: 3, borderRadius: 2 },
  progressDot: { position: 'absolute', borderWidth: 2 },
  trackFill: { height: 4, borderRadius: 2 },
});

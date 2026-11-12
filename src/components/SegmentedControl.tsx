import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { chipColors, isCinema, shape, fonts, useThemeColors } from '@/lib/theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * Posición de la iluminación en número de opción (0, 1, …), animada desde fuera: la píldora
   * se desliza con ella (p. ej. siguiendo al dedo al pasar de página) en vez de saltar.
   */
  position?: Animated.AnimatedInterpolation<number>;
};

const PADDING = 3;

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  position,
}: Props<T>) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const segment = width > 0 ? (width - PADDING * 2) / options.length : 0;
  const selectedChip = chipColors(colors, true);
  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[
        styles.container,
        {
          backgroundColor: isCinema ? colors.elevated : colors.surface,
          borderColor: isCinema ? 'transparent' : colors.border,
        },
      ]}
    >
      {position && segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: segment,
              backgroundColor: selectedChip.backgroundColor,
              borderColor: selectedChip.borderColor,
              transform: [
                {
                  translateX: position.interpolate({
                    inputRange: [0, Math.max(1, options.length - 1)],
                    outputRange: [0, segment * Math.max(1, options.length - 1)],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[
              styles.segment,
              // Con `position` la iluminación es la píldora que se desliza (no cada segmento).
              selected && !position && { backgroundColor: selectedChip.backgroundColor },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? chipColors(colors, true).color : colors.text },
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderRadius: shape.button, borderWidth: 1, padding: PADDING },
  indicator: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: shape.button,
    borderWidth: 1,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: shape.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 14, fontFamily: fonts.title },
});

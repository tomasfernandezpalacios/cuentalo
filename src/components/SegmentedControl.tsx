import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CINEMA_ELEVATED_2, chipColors, isCinema, shape, fonts, useThemeColors } from '@/lib/theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const colors = useThemeColors();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.container,
        {
          backgroundColor: isCinema ? CINEMA_ELEVATED_2 : colors.surface,
          borderColor: isCinema ? 'transparent' : colors.border,
        },
      ]}
    >
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
              selected && { backgroundColor: chipColors(colors, true).backgroundColor },
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
  container: { flexDirection: 'row', borderRadius: shape.button, borderWidth: 1, padding: 3 },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: shape.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 14, fontFamily: fonts.title },
});

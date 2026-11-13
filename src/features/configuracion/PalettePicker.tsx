import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PALETTE_NAMES, PALETTES, type PaletteName } from '@/lib/palettes';
import { chipColors, fonts, useThemeColors } from '@/lib/theme';

type Props = {
  value: PaletteName;
  onChange: (palette: PaletteName) => void;
};

/** Muestra de una paleta: sus tres colores en proporción 60 / 30 / 10. */
function Swatch({ colors }: { colors: [string, string, string] }) {
  const border = useThemeColors().border;
  return (
    <View style={[styles.swatch, { borderColor: border }]}>
      <View style={{ flex: 6, backgroundColor: colors[0] }} />
      <View style={{ flex: 3, backgroundColor: colors[1] }} />
      <View style={{ flex: 1, backgroundColor: colors[2] }} />
    </View>
  );
}

/**
 * Elegir la paleta de prueba (regla 60-30-10) o «Cine», el estilo de siempre. Cada opción enseña
 * sus tres colores en la proporción en que se usan.
 */
export function PalettePicker({ value, onChange }: Props) {
  const colors = useThemeColors();
  const options: { name: PaletteName; label: string; swatch: [string, string, string] }[] = [
    { name: 'cine', label: 'Cine (el de siempre)', swatch: ['#0B0A09', '#F5F1E8', '#E9C46A'] },
    ...PALETTE_NAMES.map((name) => ({
      name,
      label: PALETTES[name].label,
      swatch: PALETTES[name].swatches,
    })),
  ];
  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const selected = option.name === value;
        const chip = chipColors(colors, selected);
        return (
          <Pressable
            key={option.name}
            onPress={() => onChange(option.name)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`Paleta ${option.label}`}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: chip.backgroundColor,
                borderColor: selected ? colors.primary : colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Swatch colors={option.swatch} />
            <Text style={[styles.label, { color: chip.color }]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    gap: 6,
  },
  swatch: {
    flexDirection: 'row',
    height: 28,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
  },
  label: { fontSize: 13, fontFamily: fonts.title },
});

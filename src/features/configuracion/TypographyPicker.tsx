import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TYPOGRAPHIES, TYPOGRAPHY_NAMES, type TypographyName } from '@/lib/typography';
import { chipColors, useThemeColors } from '@/lib/theme';

type Props = {
  value: TypographyName;
  onChange: (typography: TypographyName) => void;
};

/**
 * Elegir la combinación de tipografías de prueba. Cada opción se enseña con sus propias letras:
 * el nombre con la de los títulos y debajo una frase con la del texto, para verlas juntas.
 */
export function TypographyPicker({ value, onChange }: Props) {
  const colors = useThemeColors();
  return (
    <View style={styles.list}>
      {TYPOGRAPHY_NAMES.map((name) => {
        const option = TYPOGRAPHIES[name];
        const selected = name === value;
        const chip = chipColors(colors, selected);
        return (
          <Pressable
            key={name}
            onPress={() => onChange(name)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`Tipografía ${option.label}: ${option.description}`}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: chip.backgroundColor,
                borderColor: selected ? colors.primary : colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[styles.sample, { color: chip.color, fontFamily: option.fonts.display }]}>
              {option.label}
            </Text>
            <Text style={[styles.text, { color: colors.text, fontFamily: option.fonts.detail }]}>
              Cuenta lo que haces, día a día.
            </Text>
            <Text
              style={[styles.text, { color: colors.textMuted, fontFamily: option.fonts.title }]}
            >
              {option.description}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  option: { borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  sample: { fontSize: 24 },
  text: { fontSize: 14 },
});

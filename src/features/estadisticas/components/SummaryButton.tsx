import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useSettings } from '@/features/configuracion/settings';
import { fonts, useThemeColors } from '@/lib/theme';

/**
 * Botón de la cabecera de Estadísticas que abre el resumen. Hasta que se genera el primero dice
 * «Generar resumen» junto al libro; después, solo el libro.
 */
export function SummaryButton() {
  const colors = useThemeColors();
  const { birthDate } = useSettings();
  const first = birthDate === null;
  return (
    <Pressable
      onPress={() => router.push('/resumen')}
      accessibilityRole="button"
      accessibilityLabel={first ? 'Generar resumen' : 'Ver tu resumen'}
      hitSlop={10}
      style={({ pressed }) => [
        styles.button,
        first && { backgroundColor: colors.primarySoft },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {first ? <Text style={[styles.text, { color: colors.primary }]}>Generar resumen</Text> : null}
      <Ionicons name="book-outline" size={22} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    marginRight: 6,
  },
  text: { fontSize: 14, fontFamily: fonts.title },
});

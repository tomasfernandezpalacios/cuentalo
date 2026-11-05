import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useBirthDate } from '@/features/perfil/birthDate';
import { fonts, useThemeColors } from '@/lib/theme';

/**
 * Botón de la cabecera de Estadísticas que abre el «Resumen vital». Hasta que se genera el
 * primero (sin fecha de nacimiento en la cuenta) dice «Resumen vital» junto al libro; después,
 * solo el libro.
 */
export function SummaryButton() {
  const colors = useThemeColors();
  const birthDate = useBirthDate();
  const first = birthDate.data === null;
  return (
    <Pressable
      onPress={() => router.push('/resumen')}
      accessibilityRole="button"
      accessibilityLabel={first ? 'Generar tu resumen vital' : 'Resumen vital'}
      hitSlop={10}
      style={({ pressed }) => [
        styles.button,
        first && { backgroundColor: colors.primarySoft },
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {first ? <Text style={[styles.text, { color: colors.primary }]}>Resumen vital</Text> : null}
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

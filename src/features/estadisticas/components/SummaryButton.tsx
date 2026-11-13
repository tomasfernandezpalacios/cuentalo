import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useBirthDate } from '@/features/perfil/birthDate';
import { fonts, useThemeColors } from '@/lib/theme';

/**
 * Botón de la cabecera de Estadísticas que abre el «Resumen vital». Hasta que se genera el
 * primero (sin fecha de nacimiento en la cuenta) dice «Resumen vital» junto al libro; después,
 * solo el libro en un círculo (se probó «Mi vida en números» y el usuario prefirió sin texto).
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
        // Relleno del color de la app (llamativo); sin texto, un círculo con el libro.
        { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
        !first && styles.round,
      ]}
    >
      {first ? (
        <Text
          style={[styles.text, { color: colors.onPrimary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          Resumen vital
        </Text>
      ) : null}
      <Ionicons name="book" size={first ? 18 : 20} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    marginRight: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  round: { width: 36, paddingHorizontal: 0, justifyContent: 'center' },
  text: { fontSize: 14, fontFamily: fonts.title },
});

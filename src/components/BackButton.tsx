import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useThemeColors } from '@/lib/theme';

/**
 * Flecha para volver atrás. Se usa en la cabecera de todas las pantallas que se abren encima de
 * otra (crear, editar, filtros…), también en las que se abren como ventana, para que siempre
 * haya la misma flecha en vez de un «Cancelar».
 */
export function BackButton() {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Volver"
      hitSlop={12}
      style={styles.button}
    >
      <Ionicons name="arrow-back" size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingRight: 12 },
});

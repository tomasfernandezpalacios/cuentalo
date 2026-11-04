import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

import { useStreak } from '../api';

/**
 * Rectángulo con el fuego y los días de racha, junto al título de «Mis contadores». En color si
 * hoy ya se ha mantenido; en gris si aún no. Abre la pantalla de racha.
 */
export function StreakBadge() {
  const colors = useThemeColors();
  const streak = useStreak();
  const days = streak.data?.current ?? 0;
  // En color solo si hoy ya se ha mantenido la racha; si no, en gris.
  const done = streak.data?.todayDone ?? false;
  const color = done ? colors.flame : colors.textMuted;

  return (
    <Pressable
      onPress={() => router.push('/racha')}
      accessibilityRole="button"
      accessibilityLabel={`Racha de ${days} ${days === 1 ? 'día' : 'días'}${done ? '' : ', hoy aún sin mantener'}. Ver calendario`}
      hitSlop={8}
      style={({ pressed }) => [
        styles.badge,
        {
          backgroundColor: done ? `${colors.flame}1F` : colors.background,
          borderColor: done ? colors.flame : colors.border,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons name="flame" size={26} color={color} />
      <Text style={[styles.number, { color }]} maxFontSizeMultiplier={1.3}>
        {days}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Rectángulo con el fuego y el número, más grande que el título.
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  number: { fontSize: 20, fontFamily: fonts.title },
});

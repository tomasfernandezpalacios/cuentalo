import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

import { useStreak } from '../api';

/** Fuego con los días de racha, junto al título de «Mis contadores». Abre la pantalla de racha. */
export function StreakBadge() {
  const colors = useThemeColors();
  const streak = useStreak();
  const days = streak.data?.current ?? 0;
  const color = days > 0 ? colors.flame : colors.textMuted;

  return (
    <Pressable
      onPress={() => router.push('/racha')}
      accessibilityRole="button"
      accessibilityLabel={`Racha de ${days} ${days === 1 ? 'día' : 'días'}. Ver calendario`}
      hitSlop={8}
      style={({ pressed }) => [styles.badge, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name="flame" size={22} color={color} />
      <Text style={[styles.number, { color }]} maxFontSizeMultiplier={1.3}>
        {days}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  number: { fontSize: 17, fontFamily: fonts.title },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

import { useStreak } from '../api';

type Props = {
  /** Si se pasa, la tarjeta se puede pulsar (en Estadísticas lleva a la pantalla de racha). */
  onPress?: () => void;
};

/** Rectángulo grande con el fuego y los días de racha actuales. */
export function StreakCard({ onPress }: Props) {
  const colors = useThemeColors();
  const streak = useStreak();
  const current = streak.data?.current ?? 0;
  const best = streak.data?.best ?? 0;
  // En color solo si hoy ya se ha mantenido la racha; si no, en gris.
  const active = streak.data?.todayDone ?? false;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Racha de ${current} ${current === 1 ? 'día' : 'días'}. Mejor racha: ${best}`}
      accessibilityHint={onPress ? 'Abre el calendario de tu racha' : undefined}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: active ? `${colors.flame}1F` : colors.surface,
          borderColor: active ? colors.flame : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons name="flame" size={64} color={active ? colors.flame : colors.textMuted} />
      <View style={styles.texts}>
        <Text style={[styles.number, { color: colors.text }]}>{current}</Text>
        <Text style={[styles.label, { color: colors.text }]}>
          {current === 1 ? 'día de racha' : 'días de racha'}
        </Text>
        <Text style={[styles.detail, { color: colors.textMuted }]}>
          {active
            ? `Mejor racha: ${best}`
            : current > 0
              ? 'Registra algo hoy para mantenerla'
              : 'Registra algo hoy para empezar una racha'}
        </Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={22} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  texts: { flex: 1, gap: 2 },
  number: { fontSize: 44, fontFamily: fonts.title, lineHeight: 50 },
  label: { fontSize: 17, fontFamily: fonts.title },
  detail: { fontSize: 14, fontFamily: fonts.detail, marginTop: 4 },
});

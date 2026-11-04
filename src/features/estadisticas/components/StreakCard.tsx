import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

import { useStreak } from '../api';
import { localToday } from '../periods';
import { weekProgress } from '../streaks';

type Props = {
  /** Si se pasa, la tarjeta se puede pulsar (en Estadísticas y el perfil lleva a la racha). */
  onPress?: () => void;
};

/**
 * Rectángulo de la racha (Estadísticas, perfil y pantalla de racha): «🔥 N días de racha» en
 * una línea, debajo la mejor racha alineada con el número y, abajo, la semana actual.
 */
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
      <View style={styles.top}>
        <Ionicons name="flame" size={40} color={active ? colors.flame : colors.textMuted} />
        <View style={styles.texts}>
          <View style={styles.headline}>
            <Text style={[styles.number, { color: colors.text }]}>{current}</Text>
            <Text style={[styles.label, { color: colors.text }]}>
              {current === 1 ? 'día de racha' : 'días de racha'}
            </Text>
          </View>
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            {`Mejor racha: ${best} ${best === 1 ? 'día' : 'días'}`}
          </Text>
          {active ? null : (
            <Text style={[styles.detail, { color: colors.textMuted }]}>
              {current > 0
                ? 'Registra algo hoy para mantenerla'
                : 'Registra algo hoy para empezar una racha'}
            </Text>
          )}
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={22} color={colors.textMuted} /> : null}
      </View>
      {streak.data ? <WeekBar days={streak.data.days} /> : null}
    </Pressable>
  );
}

/**
 * La semana actual (lunes → domingo): una barra por día, de color si ese día se mantuvo la racha,
 * gris si no y más clara si aún no ha llegado. Hoy lleva un borde.
 */
function WeekBar({ days }: { days: Set<string> }) {
  const colors = useThemeColors();
  const week = weekProgress(days, localToday());
  const kept = week.filter((d) => d.done).length;
  const elapsed = week.filter((d) => !d.future).length;
  return (
    <View
      style={styles.week}
      accessible
      accessibilityLabel={`Esta semana has mantenido la racha ${kept} de ${elapsed} días`}
    >
      <View style={styles.weekHeader}>
        <Text style={[styles.weekTitle, { color: colors.text }]}>Esta semana</Text>
        <Text style={[styles.weekCount, { color: colors.textMuted }]}>{kept} de 7 días</Text>
      </View>
      <View style={styles.weekRow}>
        {week.map((d) => (
          <View key={d.day} style={styles.weekDay}>
            <View
              style={[
                styles.segment,
                {
                  backgroundColor: d.done ? colors.flame : colors.border,
                  opacity: d.future ? 0.45 : 1,
                  borderColor: d.isToday
                    ? d.done
                      ? colors.flame
                      : colors.textMuted
                    : 'transparent',
                },
              ]}
            />
            <Text
              style={[styles.weekLetter, { color: d.isToday ? colors.text : colors.textMuted }]}
            >
              {d.letter}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, borderWidth: 1.5, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // El número y «días de racha» en la misma línea, apoyados en la misma base.
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  week: { gap: 8 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  weekTitle: { fontSize: 15, fontFamily: fonts.title },
  weekCount: { fontSize: 13, fontFamily: fonts.detail },
  weekRow: { flexDirection: 'row', gap: 6 },
  weekDay: { flex: 1, alignItems: 'center', gap: 4 },
  segment: { alignSelf: 'stretch', height: 12, borderRadius: 6, borderWidth: 2 },
  weekLetter: { fontSize: 12, fontFamily: fonts.title },
  texts: { flex: 1, gap: 2 },
  number: { fontSize: 34, fontFamily: fonts.title, lineHeight: 40 },
  label: { fontSize: 17, fontFamily: fonts.title },
  detail: { fontSize: 14, fontFamily: fonts.detail },
});

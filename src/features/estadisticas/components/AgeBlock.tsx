import { type ReactNode, useEffect, useState } from 'react';
import { type GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, shape, useThemeColors } from '@/lib/theme';

import { ageBreakdown, birthStart } from '../age';

type Props = {
  /** 'AAAA-MM-DD' */
  birthDate: string;
  /** Arriba a la derecha (en el Resumen vital: el + para llevarlo a Estadísticas). */
  action?: ReactNode;
  onPress?: () => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  onPressOut?: () => void;
};

/** Hora actual que se actualiza cada segundo (para la edad en tiempo real). */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * «Tienes»: la edad en tiempo real (años, meses, semanas, días, horas, minutos y segundos), en
 * casillas. Sale en el Resumen vital y, si se añade, en Estadísticas.
 */
export function AgeBlock({ birthDate, action, onPress, onLongPress, onPressOut }: Props) {
  const colors = useThemeColors();
  const now = useNow();
  const age = ageBreakdown(birthStart(birthDate), now);
  const parts: { value: number; label: [string, string] }[] = [
    { value: age.years, label: ['año', 'años'] },
    { value: age.months, label: ['mes', 'meses'] },
    { value: age.weeks, label: ['semana', 'semanas'] },
    { value: age.days, label: ['día', 'días'] },
    { value: age.hours, label: ['hora', 'horas'] },
    { value: age.minutes, label: ['minuto', 'minutos'] },
    { value: age.seconds, label: ['segundo', 'segundos'] },
  ];

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressOut={onPressOut}
      disabled={!onPress && !onLongPress}
      accessibilityLabel={`Tienes ${parts.map((p) => `${p.value} ${p.label[p.value === 1 ? 0 : 1]}`).join(', ')}`}
      style={[styles.block, { backgroundColor: colors.primarySoft }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Tienes</Text>
        {action}
      </View>
      <View style={styles.grid}>
        {parts.map((p) => (
          <View key={p.label[1]} style={[styles.tile, { backgroundColor: colors.surface }]}>
            <Text style={[styles.value, { color: colors.primary }]} allowFontScaling={false}>
              {p.value}
            </Text>
            <Text style={[styles.label, { color: colors.textMuted }]}>
              {p.label[p.value === 1 ? 0 : 1]}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { borderRadius: shape.card, padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 22, fontFamily: fonts.title },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 72,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  value: { fontSize: 28, fontFamily: fonts.display, fontVariant: ['tabular-nums'] },
  label: { fontSize: 13, fontFamily: fonts.detail },
});

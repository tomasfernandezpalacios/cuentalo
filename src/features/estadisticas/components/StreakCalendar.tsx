import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

import { localToday } from '../periods';
import { monthGrid } from '../streaks';

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Calendario mensual con los días de actividad rellenos; se puede ir a meses anteriores. */
export function StreakCalendar({ activeDays }: { activeDays: Set<string> }) {
  const colors = useThemeColors();
  const today = localToday();
  const [month, setMonth] = useState({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  });
  const isCurrentMonth =
    month.year === Number(today.slice(0, 4)) && month.month === Number(today.slice(5, 7));

  function move(delta: number) {
    setMonth(({ year, month: m }) => {
      const index = year * 12 + (m - 1) + delta;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
  }

  const weeks = monthGrid(month.year, month.month);
  const activeInMonth = weeks.flat().filter((d) => d && activeDays.has(d)).length;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => move(-1)}
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {MONTHS[month.month - 1]} {month.year}
        </Text>
        <Pressable
          onPress={() => move(1)}
          disabled={isCurrentMonth}
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
          accessibilityState={{ disabled: isCurrentMonth }}
          hitSlop={10}
          style={{ opacity: isCurrentMonth ? 0.3 : 1 }}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.week}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={[styles.weekday, { color: colors.textMuted }]}>
            {d}
          </Text>
        ))}
      </View>

      {weeks.map((week, i) => (
        <View key={i} style={styles.week}>
          {week.map((day, j) => {
            if (!day) return <View key={j} style={styles.cell} />;
            const active = activeDays.has(day);
            const isToday = day === today;
            return (
              <View
                key={j}
                style={styles.cell}
                accessible
                accessibilityLabel={`${Number(day.slice(8, 10))}${active ? ', con actividad' : ''}${isToday ? ', hoy' : ''}`}
              >
                <View
                  style={[
                    styles.dayCircle,
                    active && { backgroundColor: colors.flame },
                    isToday && { borderColor: colors.primary, borderWidth: 2 },
                  ]}
                >
                  <Text
                    style={[styles.dayText, { color: active ? '#FFFFFF' : colors.text }]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {Number(day.slice(8, 10))}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}

      <Text style={[styles.summary, { color: colors.textMuted }]}>
        {activeInMonth === 1
          ? '1 día con actividad este mes'
          : `${activeInMonth} días con actividad este mes`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 6 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: { fontSize: 18, fontFamily: fonts.title },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 13, fontFamily: fonts.detail },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 15, fontFamily: fonts.title },
  summary: { fontSize: 14, fontFamily: fonts.detail, textAlign: 'center', marginTop: 6 },
});

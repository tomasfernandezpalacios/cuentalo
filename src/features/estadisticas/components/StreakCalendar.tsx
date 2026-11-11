import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fonts, titleFont, useThemeColors } from '@/lib/theme';

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

/** Cuánto hay que deslizar (puntos) para cambiar de mes. */
const SWIPE_MIN = 50;

type Swipe = { canGoNext: boolean; onMove: (delta: number) => void };

/** Lo que el gesto necesita del último render (fuera de React, con métodos para cambiarlo). */
function createSwipeState(initial: Swipe) {
  let options = initial;
  let width = 300;
  return {
    options: () => options,
    setOptions: (value: Swipe) => {
      options = value;
    },
    width: () => width,
    setWidth: (value: number) => {
      width = value;
    },
  };
}

/**
 * Deslizar los días a un lado para cambiar de mes: siguen al dedo y, al soltar, salen por ese
 * lado y entra el mes nuevo por el otro. Sin pasar del mes actual (ahí el deslizamiento se frena).
 * Solo se queda con gestos claramente horizontales: los verticales siguen moviendo la pantalla.
 */
function useMonthSwipe(options: Swipe) {
  const [offset] = useState(() => new Animated.Value(0));
  const [latest] = useState(() => createSwipeState(options));
  useEffect(() => {
    latest.setOptions(options);
  });

  function slide(toValue: number, done?: () => void) {
    Animated.timing(offset, {
      toValue,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(done);
  }

  const [responder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => {
        // Hacia el futuro desde el mes actual: se mueve poco, para notar que no hay más.
        const blocked = g.dx < 0 && !latest.options().canGoNext;
        offset.setValue(blocked ? g.dx * 0.2 : g.dx);
      },
      onPanResponderRelease: (_e, g) => {
        const width = latest.width();
        const current = latest.options();
        const delta = g.dx <= -SWIPE_MIN && current.canGoNext ? 1 : g.dx >= SWIPE_MIN ? -1 : 0;
        if (delta === 0) {
          slide(0);
          return;
        }
        // Sale por el lado del gesto, cambia el mes y entra el nuevo por el otro.
        slide(-delta * width, () => {
          current.onMove(delta);
          offset.setValue(delta * width);
          slide(0);
        });
      },
      onPanResponderTerminate: () => slide(0),
      onPanResponderTerminationRequest: () => false,
    }),
  );

  return {
    offset,
    panHandlers: responder.panHandlers,
    onLayout: (e: LayoutChangeEvent) => latest.setWidth(e.nativeEvent.layout.width),
  };
}

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

  // Deslizar con el dedo: hacia la izquierda, el mes siguiente; hacia la derecha, el anterior.
  const swipe = useMonthSwipe({ canGoNext: !isCurrentMonth, onMove: move });

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

      <Animated.View
        {...swipe.panHandlers}
        onLayout={swipe.onLayout}
        style={[styles.days, { transform: [{ translateX: swipe.offset }] }]}
      >
        {weeks.map((week, i) => (
          <View key={i} style={styles.week}>
            {week.map((day, j) => {
              if (!day) return <View key={j} style={styles.cell} />;
              const active = activeDays.has(day);
              const isToday = day === today;
              return (
                // Clave por día (no por posición): al cambiar de mes se crean círculos nuevos.
                <View
                  key={day}
                  style={styles.cell}
                  accessible
                  accessibilityLabel={`${Number(day.slice(8, 10))}${active ? ', con actividad' : ''}${isToday ? ', hoy' : ''}`}
                >
                  <View
                    // Siempre con fondo (transparente si no hay actividad) y borde: en Android,
                    // si una vista sin fondo lo recibe después, pierde el redondeo y sale cuadrada.
                    style={[
                      styles.dayCircle,
                      {
                        backgroundColor: active ? colors.flame : 'transparent',
                        borderColor: isToday ? colors.primary : 'transparent',
                      },
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
      </Animated.View>

      <Text style={[styles.summary, { color: colors.textMuted }]}>
        {activeInMonth === 1
          ? '1 día con actividad este mes'
          : `${activeInMonth} días con actividad este mes`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 6, overflow: 'hidden' },
  days: { gap: 6 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: { ...titleFont(18) },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 13, fontFamily: fonts.detail },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 15, fontFamily: fonts.title },
  summary: { fontSize: 14, fontFamily: fonts.detail, textAlign: 'center', marginTop: 6 },
});

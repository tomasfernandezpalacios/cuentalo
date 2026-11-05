import { type ComponentRef, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { monthGrid } from '@/features/estadisticas/streaks';
import { fonts, useThemeColors } from '@/lib/theme';

// Calendario de la app para elegir una fecha de nacimiento (en vez del selector del sistema).
// Tres pasos, porque ir mes a mes hacia atrás sería eterno: año → mes → día. Arriba, tres
// pestañas con lo elegido para volver a cualquiera de los pasos.

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const FIRST_YEAR = 1900;
const YEAR_ROW = 52;

type Step = 'year' | 'month' | 'day';
type Parts = { year: number; month: number; day: number };

const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (p: Parts) => `${p.year}-${pad(p.month)}-${pad(p.day)}`;
const daysIn = (year: number, month: number) => new Date(year, month, 0).getDate();

function todayParts(): Parts {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/** Ajusta el día al mes (31 → 30/28) y no deja pasar de hoy. */
function clampParts(p: Parts): Parts {
  const today = todayParts();
  let { year, month, day } = p;
  if (year > today.year) year = today.year;
  if (year === today.year && month > today.month) month = today.month;
  day = Math.min(day, daysIn(year, month));
  if (year === today.year && month === today.month && day > today.day) day = today.day;
  return { year, month, day };
}

type Props = {
  /** 'AAAA-MM-DD' */
  value: string;
  onChange: (value: string) => void;
  /** Por qué paso empieza (al darla por primera vez, por el año). */
  initialView?: Step;
};

export function BirthDatePicker({ value, onChange, initialView = 'day' }: Props) {
  const colors = useThemeColors();
  const [view, setView] = useState<Step>(initialView);
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const parts: Parts = { year: y, month: m, day: d };
  const today = todayParts();
  const yearsRef = useRef<ComponentRef<typeof ScrollView>>(null);

  function set(next: Partial<Parts>, goTo?: Step) {
    onChange(toKey(clampParts({ ...parts, ...next })));
    if (goTo) setView(goTo);
  }

  const tab = (key: Step, label: string, a11y: string) => {
    const on = view === key;
    return (
      <Pressable
        key={key}
        onPress={() => setView(key)}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={a11y}
        style={[
          styles.tab,
          {
            backgroundColor: on ? colors.primary : colors.background,
            borderColor: on ? colors.primary : colors.border,
          },
        ]}
      >
        <Text style={[styles.tabText, { color: on ? colors.onPrimary : colors.text }]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const cell = (
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void,
    disabled = false,
    style?: object,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.cell,
        style,
        {
          backgroundColor: selected ? colors.primary : 'transparent',
          opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text style={[styles.cellText, { color: selected ? colors.onPrimary : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );

  // Años de más reciente a más antiguo, de 4 en 4.
  const years: number[][] = [];
  for (let year = today.year; year >= FIRST_YEAR; year -= 4) {
    years.push([0, 1, 2, 3].map((i) => year - i).filter((v) => v >= FIRST_YEAR));
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {tab('day', String(parts.day), `Día ${parts.day}. Cambiar`)}
        {tab('month', MONTHS[parts.month - 1] ?? '', `Mes ${MONTHS[parts.month - 1]}. Cambiar`)}
        {tab('year', String(parts.year), `Año ${parts.year}. Cambiar`)}
      </View>

      {view === 'year' ? (
        <ScrollView
          ref={yearsRef}
          style={styles.years}
          nestedScrollEnabled
          onLayout={() => {
            // Empieza enseñando el año elegido.
            const row = Math.floor((today.year - parts.year) / 4);
            yearsRef.current?.scrollTo({ y: Math.max(0, (row - 2) * YEAR_ROW), animated: false });
          }}
        >
          {years.map((row) => (
            <View key={row[0]} style={styles.yearRow}>
              {row.map((year) =>
                cell(
                  String(year),
                  String(year),
                  year === parts.year,
                  () => set({ year }, 'month'),
                  false,
                  styles.yearCell,
                ),
              )}
              {row.length < 4
                ? Array.from({ length: 4 - row.length }, (_, i) => (
                    <View key={`hueco-${i}`} style={[styles.cell, styles.yearCell]} />
                  ))
                : null}
            </View>
          ))}
        </ScrollView>
      ) : view === 'month' ? (
        <View style={styles.monthGrid}>
          {MONTHS.map((name, i) =>
            cell(
              name,
              name,
              i + 1 === parts.month,
              () => set({ month: i + 1 }, 'day'),
              parts.year === today.year && i + 1 > today.month,
              styles.monthCell,
            ),
          )}
        </View>
      ) : (
        <View>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={[styles.weekday, { color: colors.textMuted }]}>
                {w}
              </Text>
            ))}
          </View>
          {monthGrid(parts.year, parts.month).map((week, i) => (
            <View key={i} style={styles.weekRow}>
              {week.map((day, j) =>
                day === null ? (
                  <View key={`vacío-${j}`} style={[styles.cell, styles.dayCell]} />
                ) : (
                  cell(
                    day,
                    String(Number(day.slice(8))),
                    day === value,
                    () => set({ day: Number(day.slice(8)) }),
                    day > toKey(today),
                    styles.dayCell,
                  )
                ),
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 12 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: { fontSize: 15, fontFamily: fonts.title },
  cell: { alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  cellText: { fontSize: 15, fontFamily: fonts.title },
  years: { maxHeight: YEAR_ROW * 5 },
  yearRow: { flexDirection: 'row', gap: 6, height: YEAR_ROW, alignItems: 'center' },
  yearCell: { flex: 1, height: 44 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  monthCell: { width: '33.33%', height: 48 },
  weekRow: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: fonts.detail,
    paddingVertical: 4,
  },
  dayCell: { flex: 1, aspectRatio: 1, maxHeight: 46 },
});

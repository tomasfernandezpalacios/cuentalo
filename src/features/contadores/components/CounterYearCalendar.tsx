import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useUserId } from '@/features/auth/AuthProvider';
import { useMyDailyTotals } from '@/features/estadisticas/api';
import { localToday } from '@/features/estadisticas/periods';
import { withAlpha } from '@/lib/color';
import { pluralize } from '@/lib/format';
import { fonts, shape, useThemeColors } from '@/lib/theme';

import { MONTH_INITIALS, selectableYears, yearMonths } from '../yearGrid';

/** Hueco entre cuadrados y ancho de la columna de las iniciales de los meses. */
const GAP = 2;
const LABEL = 14;

/**
 * Detalle de un contador: el año en cuadraditos (petición del usuario), una fila por mes y uno
 * por día. Se iluminan los días en los que registré algo en él, da igual la cantidad. Con flechas
 * se pasa a años anteriores (desde el del primer registro).
 */
export function CounterYearCalendar({ counterIds }: { counterIds: string[] }) {
  const colors = useThemeColors();
  const daily = useMyDailyTotals(useUserId());
  const today = localToday();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [width, setWidth] = useState(0);

  if (daily.isPending || daily.isError) return null;

  // Días con algún registro mío en este contador (o sus fusionados).
  const logged = new Set(
    daily.data.filter((d) => counterIds.includes(d.counterId)).map((d) => d.day),
  );
  const firstDay = [...logged].sort()[0] ?? null;
  const years = selectableYears(today, firstDay);
  const months = yearMonths(year);
  const count = months.flat().filter((day) => logged.has(day)).length;
  // 31 columnas: la del mes más largo. El cuadrado sale del ancho disponible.
  const cell = width > 0 ? Math.floor((width - LABEL - GAP - 30 * GAP) / 31) : 0;
  const canBack = year > (years[0] ?? year);
  const canForward = year < (years.at(-1) ?? year);
  const empty = withAlpha(colors.textMuted, 0.18);

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible
      accessibilityLabel={`${year}: ${pluralize(count, 'día', 'días')} con algún registro`}
    >
      <View style={styles.top}>
        <Pressable
          onPress={() => setYear((y) => y - 1)}
          disabled={!canBack}
          accessibilityRole="button"
          accessibilityLabel="Año anterior"
          hitSlop={12}
          style={{ opacity: canBack ? 1 : 0.25 }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.year, { color: colors.text }]}>{year}</Text>
        <Pressable
          onPress={() => setYear((y) => y + 1)}
          disabled={!canForward}
          accessibilityRole="button"
          accessibilityLabel="Año siguiente"
          hitSlop={12}
          style={{ opacity: canForward ? 1 : 0.25 }}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {cell > 0
          ? months.map((days, m) => (
              <View key={m} style={styles.row}>
                <Text style={[styles.month, { color: colors.textMuted }]}>{MONTH_INITIALS[m]}</Text>
                {days.map((day) => {
                  const on = logged.has(day);
                  const future = day > today;
                  return (
                    <View
                      key={day}
                      style={[
                        {
                          width: cell,
                          height: cell,
                          borderRadius: Math.max(2, cell / 4),
                          backgroundColor: on ? colors.primary : empty,
                          opacity: future ? 0.4 : 1,
                        },
                        // Hoy, con borde.
                        day === today && {
                          borderWidth: 1.5,
                          borderColor: on ? colors.text : colors.primary,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ))
          : null}
      </View>

      <Text style={[styles.count, { color: colors.textMuted }]}>
        {pluralize(count, 'día', 'días')} con algún registro en {year}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: shape.card, borderWidth: 1, padding: 14, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  year: { fontSize: 16, fontFamily: fonts.title, minWidth: 48, textAlign: 'center' },
  grid: { gap: GAP },
  row: { flexDirection: 'row', alignItems: 'center', gap: GAP },
  month: { width: LABEL, fontSize: 10, fontFamily: fonts.detail, textAlign: 'center' },
  count: { fontSize: 13, fontFamily: fonts.detail, textAlign: 'center' },
});

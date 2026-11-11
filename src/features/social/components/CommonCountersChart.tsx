import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useUserId } from '@/features/auth/AuthProvider';
import { fetchGroupCounterDaily } from '@/features/contadores/api';
import { counterKeys } from '@/features/contadores/hooks';
import { CounterChipsBar } from '@/features/estadisticas/components/CounterChipsBar';
import { StatsChart, type ChartType } from '@/features/estadisticas/components/StatsChart';
import {
  bucketTitle,
  chartBuckets,
  chartValues,
  localToday,
  type DailyTotal,
  type Period,
} from '@/features/estadisticas/periods';
import { chartColor } from '@/lib/chartColors';
import { formatWithUnit } from '@/lib/format';
import { fonts, proseFont, useThemeColors } from '@/lib/theme';

import type { UserCounter } from '../api';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
  { value: 'all', label: 'Histórico' },
];

type Props = {
  /** Contadores de grupos en los que estamos los dos. */
  counters: UserCounter[];
  friendId: string;
  friendName: string;
};

/**
 * Perfil de otra persona: tú frente a ella en los contadores en común. La barra de botones elige
 * qué contadores se dibujan (por defecto, el primero); cada contador son dos series, la tuya y
 * la suya. Mismo formato que las demás gráficas (periodo, líneas o barras, ampliar).
 */
export function CommonCountersChart({ counters, friendId, friendName }: Props) {
  const colors = useThemeColors();
  const myId = useUserId();
  const [period, setPeriod] = useState<Period>('month');
  const [type, setType] = useState<ChartType>('line');
  // null = solo el primero (el valor por defecto, también si cambia la lista).
  const [visible, setVisible] = useState<string[] | null>(null);
  const visibleIds = visible ?? counters.slice(0, 1).map((c) => c.id);
  const shownCounters = counters.filter((c) => visibleIds.includes(c.id));

  // Los registros diarios de cada contador elegido (los de todos los miembros del grupo). Misma
  // clave que la gráfica del grupo: si ya se cargó allí, no se vuelve a pedir.
  const daily = useQueries({
    queries: shownCounters.map((c) => ({
      queryKey: [...counterKeys.leaderboard(c.id, 'all'), 'daily'],
      queryFn: () => fetchGroupCounterDaily(c.id),
    })),
  });

  // Cada contador, con su color en la barra; en la gráfica, dos tonos: el tuyo y el suyo.
  const chips = counters.map((c, i) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    color: chartColor(i * 2),
  }));

  function toggle(id: string) {
    setVisible(visibleIds.includes(id) ? visibleIds.filter((x) => x !== id) : [...visibleIds, id]);
  }

  function openFilters() {
    appAlert(
      'Contadores en la gráfica',
      'Elige qué contadores comparar. También puedes tocar cada uno.',
      [
        { text: 'Todos', onPress: () => setVisible(counters.map((c) => c.id)) },
        { text: 'Solo el primero', onPress: () => setVisible(null) },
        { text: 'Ninguno', onPress: () => setVisible([]) },
      ],
    );
  }

  const loading = daily.some((q) => q.isPending);
  const failed = daily.find((q) => q.isError);

  // Mismo cálculo que Estadísticas: días → puntos del eje X según el periodo.
  const perSeries: {
    id: string;
    name: string;
    color: string;
    unit: string | null;
    days: DailyTotal[];
  }[] = [];
  shownCounters.forEach((c, i) => {
    const rows = daily[i]?.data ?? [];
    const index = counters.indexOf(c);
    const label = (who: string) => (shownCounters.length === 1 ? who : `${who} · ${c.name}`);
    for (const [who, userId, shade] of [
      ['Tú', myId, 0],
      [friendName, friendId, 1],
    ] as const) {
      perSeries.push({
        id: `${c.id}:${userId}`,
        name: label(who),
        color: chartColor(index * 2 + shade),
        unit: c.unit,
        days: rows
          .filter((r) => r.userId === userId)
          .map((r) => ({ counterId: c.id, day: r.day, total: r.total, entryCount: 0 })),
      });
    }
  });
  const firstDay = perSeries
    .flatMap((s) => s.days)
    .reduce<string | null>((min, d) => (min === null || d.day < min ? d.day : min), null);
  const { buckets, granularity } = chartBuckets(period, localToday(), firstDay);
  const series = perSeries.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    values: chartValues(s.days, buckets, granularity),
  }));

  return (
    <View style={styles.container}>
      <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      <CounterChipsBar
        counters={chips}
        visibleIds={visibleIds}
        onToggle={toggle}
        onOpenFilters={openFilters}
        filtered={visibleIds.length > 1}
      />
      {failed ? (
        <Text style={[styles.muted, { color: colors.danger }]}>
          No se ha podido cargar la gráfica. Tira hacia abajo para reintentarlo.
        </Text>
      ) : loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <StatsChart
          labels={buckets.map((b) => b.label)}
          titles={buckets.map((b) => bucketTitle(b.key))}
          series={series}
          type={type}
          onChangeType={setType}
          title={`Tú y ${friendName}`}
          emptyText="Toca un contador para compararos"
        />
      )}
      {/* Lo que dibuja la gráfica, por escrito: lo de cada uno en el periodo. */}
      {!loading && series.length > 0 ? (
        <View style={styles.totals}>
          {series.map((s, i) => (
            <View key={s.id} style={styles.totalRow}>
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={[styles.total, { color: colors.text }]}>
                {formatWithUnit(
                  s.values.reduce((sum, v) => sum + v, 0),
                  perSeries[i]?.unit ?? null,
                )}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  muted: { ...proseFont(14) },
  totals: { gap: 6 },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, fontSize: 15, fontFamily: fonts.title },
  total: { fontSize: 15, fontFamily: fonts.title },
});

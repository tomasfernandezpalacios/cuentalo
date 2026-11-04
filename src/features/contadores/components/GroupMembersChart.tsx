import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { useUserId } from '@/features/auth/AuthProvider';
import { CounterChipsBar } from '@/features/estadisticas/components/CounterChipsBar';
import { StatsChart, type ChartType } from '@/features/estadisticas/components/StatsChart';
import {
  chartBuckets,
  chartValues,
  localToday,
  type DailyTotal,
} from '@/features/estadisticas/periods';
import { useGroup } from '@/features/social/hooks';
import { chartColor } from '@/lib/chartColors';
import { getErrorMessage } from '@/lib/errors';
import { formatWithUnit } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

import type { LeaderboardPeriod } from '../api';
import { useGroupCounterDaily } from '../hooks';

type Props = {
  groupId: string;
  counterId: string;
  unit: string | null;
  /** El mismo periodo que la clasificación de arriba. */
  period: LeaderboardPeriod;
};

/**
 * Gráfica del grupo: evolución del contador elegido en la clasificación, con una línea (o grupo
 * de barras) por miembro. Como en Estadísticas, una barra de botones muestra u oculta a cada
 * uno y el icono de filtros elige de golpe (todos, solo yo o nadie).
 */
export function GroupMembersChart({ groupId, counterId, unit, period }: Props) {
  const colors = useThemeColors();
  const myId = useUserId();
  const group = useGroup(groupId);
  const daily = useGroupCounterDaily(counterId);
  const [type, setType] = useState<ChartType>('line');
  // null = todos los miembros (también los que entren después).
  const [visible, setVisible] = useState<string[] | null>(null);

  if (group.isPending || daily.isPending) return <ActivityIndicator color={colors.primary} />;
  if (group.isError || daily.isError) {
    return (
      <Text style={[styles.muted, { color: colors.danger }]}>
        {getErrorMessage(group.error ?? daily.error)}
      </Text>
    );
  }

  // Yo primero y el resto por orden alfabético; cada uno con un color fijo por posición.
  const members = group.data.members
    .filter((m) => m.status === 'active')
    .sort(
      (a, b) =>
        Number(b.user_id === myId) - Number(a.user_id === myId) ||
        a.profile.display_name.localeCompare(b.profile.display_name, 'es', {
          sensitivity: 'base',
        }),
    );
  const chips = members.map((m, i) => ({
    id: m.user_id,
    name: m.user_id === myId ? 'Tú' : m.profile.display_name,
    emoji: m.profile.emoji,
    color: chartColor(i),
  }));
  const visibleIds = visible ?? chips.map((c) => c.id);
  const shown = chips.filter((c) => visibleIds.includes(c.id));

  // Mismo formato que Estadísticas (counterId hace de «serie»: aquí, cada miembro).
  const days: DailyTotal[] = daily.data
    .filter((d) => visibleIds.includes(d.userId))
    .map((d) => ({ counterId: d.userId, day: d.day, total: d.total, entryCount: 0 }));
  const firstDay = days.reduce<string | null>(
    (min, d) => (min === null || d.day < min ? d.day : min),
    null,
  );
  const { buckets, granularity } = chartBuckets(period, localToday(), firstDay);
  const series = shown.map((chip) => ({
    id: chip.id,
    name: chip.name,
    color: chip.color,
    values: chartValues(
      days.filter((d) => d.counterId === chip.id),
      buckets,
      granularity,
    ),
  }));

  function toggle(id: string) {
    const current = visible ?? chips.map((c) => c.id);
    setVisible(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function openFilters() {
    appAlert('Miembros en la gráfica', 'Elige a quién ver. También puedes tocar cada nombre.', [
      { text: 'Todos', onPress: () => setVisible(null) },
      { text: 'Solo yo', onPress: () => setVisible([myId]) },
      { text: 'Nadie', onPress: () => setVisible([]) },
    ]);
  }

  return (
    <View style={styles.container}>
      <CounterChipsBar
        counters={chips}
        visibleIds={visibleIds}
        onToggle={toggle}
        onOpenFilters={openFilters}
        filtered={visible !== null && visible.length < chips.length}
      />
      <StatsChart
        labels={buckets.map((b) => b.label)}
        series={series}
        type={type}
        onChangeType={setType}
        emptyText="Toca a un miembro para verlo en la gráfica"
      />
      {/* Lo que dibuja la gráfica, por escrito: lo de cada uno en el periodo. */}
      {series.length > 0 ? (
        <View style={styles.totals}>
          {series.map((s) => (
            <View key={s.id} style={styles.totalRow}>
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={[styles.total, { color: colors.text }]}>
                {formatWithUnit(
                  s.values.reduce((sum, v) => sum + v, 0),
                  unit,
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
  muted: { fontSize: 14, fontFamily: fonts.detail },
  totals: { gap: 6 },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, fontSize: 15, fontFamily: fonts.title },
  total: { fontSize: 15, fontFamily: fonts.title },
});

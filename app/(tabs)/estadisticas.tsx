import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { useUserId } from '@/features/auth/AuthProvider';
import { useCounterList, useMyLastCounterId } from '@/features/contadores/hooks';
import { useMyDailyTotals } from '@/features/estadisticas/api';
import { CounterChipsBar } from '@/features/estadisticas/components/CounterChipsBar';
import { ChartTotals } from '@/features/estadisticas/components/ChartTotals';
import { StreakCard } from '@/features/estadisticas/components/StreakCard';
import { StatsChart, type ChartType } from '@/features/estadisticas/components/StatsChart';
import {
  chartBuckets,
  chartValues,
  todayInMadrid,
  type Period,
} from '@/features/estadisticas/periods';
import { sortByRecentUse } from '@/features/estadisticas/recentUse';
import { toggleVisible, useStatsSelection } from '@/features/estadisticas/selection';
import { visibleCounterId } from '@/features/contadores/links';
import { chartColor } from '@/lib/chartColors';
import { useThemeColors } from '@/lib/theme';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
  { value: 'all', label: 'Histórico' },
];

export default function StatsScreen() {
  const colors = useThemeColors();
  const counters = useCounterList();
  const daily = useMyDailyTotals(useUserId());
  const selection = useStatsSelection();
  const [period, setPeriod] = useState<Period>('week');
  const [chartType, setChartType] = useState<ChartType>('line');

  const today = todayInMadrid();
  // Lo de los contadores enlazados (fusión de varios grupos) cuenta en el que se ve.
  const days = useMemo(() => {
    const resolve = visibleCounterId(counters.data ?? []);
    return (daily.data ?? []).map((d) => ({ ...d, counterId: resolve(d.counterId) }));
  }, [daily.data, counters.data]);

  // Contadores de la barra: los del filtro o, sin filtro, todos los míos, de uso más reciente a
  // menos. Los de grupos que dejé siguen si tengo registros en ellos.
  const pool = useMemo(() => {
    const all = sortByRecentUse(
      (counters.data ?? []).filter((c) => !c.linkedInto && (c.isActive || c.myEntryCount > 0)),
      days,
    );
    return selection.pool ? all.filter((c) => selection.pool?.includes(c.id)) : all;
  }, [counters.data, selection.pool, days]);

  // Por defecto se dibuja el último contador en el que registraste algo.
  const lastUsed = useMyLastCounterId(pool.map((c) => c.id));

  if (counters.isPending || daily.isPending) return <LoadingView />;
  if (counters.isError || daily.isError) {
    return (
      <ErrorView
        error={counters.error ?? daily.error}
        onRetry={() => {
          counters.refetch();
          daily.refetch();
        }}
      />
    );
  }

  if (daily.data.length === 0) {
    return (
      <EmptyView
        title="Aún no hay estadísticas"
        description="Cuando registres algo en tus contadores verás aquí tus totales y su evolución."
        actionTitle="Ir a mis contadores"
        onAction={() => router.navigate('/')}
      />
    );
  }

  const lastUsedId = lastUsed.data ? visibleCounterId(counters.data)(lastUsed.data) : null;
  const visibleIds = selection.visible ?? (lastUsedId ? [lastUsedId] : pool[0] ? [pool[0].id] : []);
  const chips = pool.map((c, i) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    color: chartColor(i),
  }));
  const shown = chips.filter((c) => visibleIds.includes(c.id));

  // Eje X según el periodo; en el histórico empieza en el primer registro de lo que se ve.
  const shownDays = days.filter((d) => visibleIds.includes(d.counterId));
  const firstDay = shownDays.reduce<string | null>(
    (min, d) => (min === null || d.day < min ? d.day : min),
    null,
  );
  const { buckets, granularity } = chartBuckets(period, today, firstDay);
  const series = shown.map((chip) => ({
    id: chip.id,
    name: chip.name,
    color: chip.color,
    values: chartValues(
      shownDays.filter((d) => d.counterId === chip.id),
      buckets,
      granularity,
    ),
  }));

  // Lo mismo que dibuja la gráfica, por escrito: total de cada contador en el periodo.
  const totals = series.map((s) => {
    const counter = pool.find((c) => c.id === s.id);
    return {
      id: s.id,
      name: s.name,
      emoji: counter?.emoji ?? null,
      unit: counter?.unit ?? null,
      color: s.color,
      total: s.values.reduce((sum, value) => sum + value, 0),
      groups: counter?.linkedGroups.map((g) => g.group) ?? [],
    };
  });

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          tintColor={colors.primary}
          colors={[colors.primary]}
          refreshing={daily.isRefetching}
          onRefresh={() => {
            counters.refetch();
            daily.refetch();
          }}
        />
      }
    >
      <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />

      <CounterChipsBar
        counters={chips}
        visibleIds={visibleIds}
        onToggle={(id) => toggleVisible(id, visibleIds)}
        onOpenFilters={() => router.push('/estadisticas/filtros')}
        filtered={selection.pool !== null}
      />

      <StatsChart
        labels={buckets.map((b) => b.label)}
        series={series}
        type={chartType}
        onChangeType={setChartType}
      />

      <ChartTotals totals={totals} />

      <StreakCard onPress={() => router.push('/racha')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20 },
});

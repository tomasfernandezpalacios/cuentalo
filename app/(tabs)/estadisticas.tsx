import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { useUserId } from '@/features/auth/AuthProvider';
import { useCounterList, useMyLastCounterId } from '@/features/contadores/hooks';
import { useMyDailyTotals } from '@/features/estadisticas/api';
import { buildCounterStats, mostUsed } from '@/features/estadisticas/buildStats';
import { CounterChipsBar } from '@/features/estadisticas/components/CounterChipsBar';
import { ChartTotals } from '@/features/estadisticas/components/ChartTotals';
import { CounterStatRow } from '@/features/estadisticas/components/CounterStatRow';
import { StatTile } from '@/features/estadisticas/components/StatTile';
import { StatsChart, type ChartType } from '@/features/estadisticas/components/StatsChart';
import {
  chartBuckets,
  chartValues,
  summarizeByCounter,
  todayInMadrid,
  type Period,
} from '@/features/estadisticas/periods';
import { toggleVisible, useStatsSelection } from '@/features/estadisticas/selection';
import { chartColor } from '@/lib/chartColors';
import { fonts, useThemeColors } from '@/lib/theme';

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
  const summaries = useMemo(() => summarizeByCounter(daily.data ?? [], today), [daily.data, today]);

  // Contadores de la barra: los del filtro o, sin filtro, todos los míos (alfabético). Los de
  // grupos que dejé siguen si tengo registros en ellos.
  const pool = useMemo(() => {
    const all = (counters.data ?? [])
      .filter((c) => c.isActive || c.myEntryCount > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    return selection.pool ? all.filter((c) => selection.pool?.includes(c.id)) : all;
  }, [counters.data, selection.pool]);

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

  const visibleIds =
    selection.visible ?? (lastUsed.data ? [lastUsed.data] : pool[0] ? [pool[0].id] : []);
  const chips = pool.map((c, i) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    color: chartColor(i),
  }));
  const shown = chips.filter((c) => visibleIds.includes(c.id));

  // Eje X según el periodo; en el histórico empieza en el primer registro de lo que se ve.
  const shownDays = daily.data.filter((d) => visibleIds.includes(d.counterId));
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
    };
  });

  const stats = buildCounterStats(counters.data, summaries, period);
  const top = mostUsed(stats);
  const entryCount = stats.reduce((sum, s) => sum + s.entryCount, 0);
  const activeCount = stats.filter((s) => s.entryCount > 0).length;

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

      <View style={styles.tiles}>
        <StatTile label="Registros" value={entryCount} />
        <StatTile label="Contadores con actividad" value={activeCount} />
      </View>

      <Section title="Más usados">
        {top.length > 0 ? (
          top.map((s, index) => (
            <CounterStatRow
              key={s.id}
              rank={index + 1}
              name={s.name}
              emoji={s.emoji}
              unit={s.unit}
              total={s.total}
              entryCount={s.entryCount}
            />
          ))
        ) : (
          <Text style={{ color: colors.textMuted, fontFamily: fonts.detail }}>
            Nada registrado en este periodo.
          </Text>
        )}
      </Section>

      <Section title="Por contador">
        {stats.map((s) => (
          <CounterStatRow
            key={s.id}
            name={s.name}
            emoji={s.emoji}
            unit={s.unit}
            total={s.total}
            entryCount={s.entryCount}
          />
        ))}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20 },
  tiles: { flexDirection: 'row', gap: 12 },
});

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { useUserId } from '@/features/auth/AuthProvider';
import { useSettings } from '@/features/configuracion/settings';
import { useCounterList, useMyLastCounterId } from '@/features/contadores/hooks';
import { useMyDailyTotals } from '@/features/estadisticas/api';
import { CounterChipsBar } from '@/features/estadisticas/components/CounterChipsBar';
import { ChartTotals } from '@/features/estadisticas/components/ChartTotals';
import { AgeBlock } from '@/features/estadisticas/components/AgeBlock';
import { StreakCard } from '@/features/estadisticas/components/StreakCard';
import { StatsChart, type ChartType } from '@/features/estadisticas/components/StatsChart';
import {
  bucketTitle,
  chartBuckets,
  chartValues,
  localToday,
  type Period,
} from '@/features/estadisticas/periods';
import { sortByRecentUse } from '@/features/estadisticas/recentUse';
import { toggleVisible, useStatsSelection } from '@/features/estadisticas/selection';
import { visibleCounterId } from '@/features/contadores/links';
import {
  type StatsBlock,
  useBirthDate,
  useSetStatsBlocks,
  useStatsBlocks,
} from '@/features/perfil/birthDate';
import { chartColor } from '@/lib/chartColors';
import { useDragReorder } from '@/lib/useDragReorder';
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
  // Bloques de la pantalla (gráfica, racha y, si se añadió, la edad) en el orden del usuario.
  const blocks = useStatsBlocks();
  const setBlocks = useSetStatsBlocks();
  const birthDate = useBirthDate().data ?? null;
  const visibleBlocks = blocks.filter((b) => b !== 'age' || birthDate !== null);
  const drag = useDragReorder({
    keys: visibleBlocks,
    gap: BLOCK_GAP,
    onReorder: (keys) =>
      setBlocks.mutate([...(keys as StatsBlock[]), ...blocks.filter((b) => !keys.includes(b))]),
  });

  const today = localToday();
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
  const { statsDefault } = useSettings();

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
  // El contador fijo elegido en Configuración, si sigue en la barra; si no, el último usado.
  const fixedId = pool.some((c) => c.id === statsDefault) ? statsDefault : null;
  const defaultId = fixedId ?? lastUsedId ?? pool[0]?.id;
  const visibleIds = selection.visible ?? (defaultId ? [defaultId] : []);
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
      scrollEnabled={!drag.dragging}
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
      {/* Bloques en el orden del usuario: mantener pulsado uno y arrastrarlo lo cambia de sitio. */}
      <View {...drag.containerProps} style={styles.blocks}>
        {visibleBlocks.map((block) => {
          const item = drag.itemProps(block);
          const press = { onLongPress: item.onLongPress, onPressOut: item.onPressOut };
          return (
            <Animated.View key={block} onLayout={item.onLayout} style={item.style}>
              <Pressable {...press} delayLongPress={350} style={styles.block}>
                {block === 'chart' ? (
                  <>
                    <SegmentedControl
                      options={PERIOD_OPTIONS}
                      value={period}
                      onChange={setPeriod}
                    />
                    <CounterChipsBar
                      counters={chips}
                      visibleIds={visibleIds}
                      onToggle={(id) => toggleVisible(id, visibleIds)}
                      onOpenFilters={() => router.push('/estadisticas/filtros')}
                      filtered={selection.pool !== null}
                    />
                    <StatsChart
                      labels={buckets.map((b) => b.label)}
                      titles={buckets.map((b) => bucketTitle(b.key))}
                      series={series}
                      type={chartType}
                      onChangeType={setChartType}
                      {...press}
                    />
                    <ChartTotals totals={totals} />
                  </>
                ) : block === 'streak' ? (
                  <StreakCard onPress={() => router.push('/racha')} {...press} />
                ) : birthDate ? (
                  <AgeBlock
                    birthDate={birthDate}
                    onPress={() => router.push('/resumen')}
                    {...press}
                  />
                ) : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const BLOCK_GAP = 20;

const styles = StyleSheet.create({
  content: { padding: 16 },
  blocks: { gap: BLOCK_GAP },
  block: { gap: BLOCK_GAP },
});

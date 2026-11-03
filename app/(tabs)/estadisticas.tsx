import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { useUserId } from '@/features/auth/AuthProvider';
import { useCounterList } from '@/features/contadores/hooks';
import { useMyDailyTotals } from '@/features/estadisticas/api';
import { buildCounterStats, mostUsed } from '@/features/estadisticas/buildStats';
import { CounterStatRow } from '@/features/estadisticas/components/CounterStatRow';
import { EvolutionChart } from '@/features/estadisticas/components/EvolutionChart';
import { StatTile } from '@/features/estadisticas/components/StatTile';
import {
  buildSeries,
  summarizeByCounter,
  todayInMadrid,
  type Granularity,
  type Period,
} from '@/features/estadisticas/periods';
import { fonts, useThemeColors } from '@/lib/theme';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
  { value: 'all', label: 'Histórico' },
];

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'week', label: 'Semanas' },
  { value: 'month', label: 'Meses' },
  { value: 'year', label: 'Años' },
];

// Cuántas barras se muestran en la gráfica para cada granularidad.
const SERIES_LENGTH: Record<Granularity, number> = { week: 12, month: 12, year: 5 };

export default function StatsScreen() {
  const colors = useThemeColors();
  const counters = useCounterList();
  const daily = useMyDailyTotals(useUserId());
  const [period, setPeriod] = useState<Period>('week');
  const [granularity, setGranularity] = useState<Granularity>('week');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const today = todayInMadrid();
  const summaries = useMemo(() => summarizeByCounter(daily.data ?? [], today), [daily.data, today]);

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

  const stats = buildCounterStats(counters.data, summaries, period);
  const top = mostUsed(stats);
  const entryCount = stats.reduce((sum, s) => sum + s.entryCount, 0);
  const activeCount = stats.filter((s) => s.entryCount > 0).length;

  // Contador de la gráfica: el elegido o, por defecto, el más usado en el histórico.
  const chartCounter =
    stats.find((s) => s.id === selectedId) ??
    mostUsed(buildCounterStats(counters.data, summaries, 'all'), 1)[0];
  const series = chartCounter
    ? buildSeries(
        daily.data.filter((d) => d.counterId === chartCounter.id),
        today,
        granularity,
        SERIES_LENGTH[granularity],
      )
    : [];

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={daily.isRefetching}
          onRefresh={() => {
            counters.refetch();
            daily.refetch();
          }}
        />
      }
    >
      <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />

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

      {chartCounter ? (
        <Section title="Evolución">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {stats.map((s) => {
              const selected = s.id === chartCounter.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedId(s.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? colors.primary : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? colors.onPrimary : colors.text,
                      fontFamily: fonts.title,
                    }}
                  >
                    {s.emoji ? `${s.emoji} ${s.name}` : s.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <SegmentedControl
            options={GRANULARITY_OPTIONS}
            value={granularity}
            onChange={setGranularity}
          />
          <EvolutionChart series={series} name={chartCounter.name} />
        </Section>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24 },
  tiles: { flexDirection: 'row', gap: 12 },
  chips: { gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
});

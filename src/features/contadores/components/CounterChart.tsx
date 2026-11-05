import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { useUserId } from '@/features/auth/AuthProvider';
import { useMyDailyTotals } from '@/features/estadisticas/api';
import { StatsChart, type ChartType } from '@/features/estadisticas/components/StatsChart';
import {
  bucketTitle,
  chartBuckets,
  chartValues,
  localToday,
  type Period,
} from '@/features/estadisticas/periods';
import { chartColor } from '@/lib/chartColors';
import { formatWithUnit } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
  { value: 'all', label: 'Histórico' },
];

type Props = {
  /** El contador y los que tenga fusionados con él (cuentan como uno). */
  counterIds: string[];
  name: string;
  unit: string | null;
};

/**
 * Detalle de un contador: la evolución de lo mío en él, encima del historial. Mismo formato que
 * las demás gráficas (periodo, líneas o barras, ampliar), sin filtros: una sola serie.
 */
export function CounterChart({ counterIds, name, unit }: Props) {
  const colors = useThemeColors();
  const daily = useMyDailyTotals(useUserId());
  const [period, setPeriod] = useState<Period>('month');
  const [type, setType] = useState<ChartType>('line');

  if (daily.isPending) return <ActivityIndicator color={colors.primary} />;
  if (daily.isError) return null;

  // Mis estadísticas de estos contadores (sin las copias para otros grupos, como en Estadísticas).
  const days = daily.data
    .filter((d) => counterIds.includes(d.counterId))
    .map((d) => ({ ...d, counterId: counterIds[0] ?? d.counterId }));
  const firstDay = days.reduce<string | null>(
    (min, d) => (min === null || d.day < min ? d.day : min),
    null,
  );
  const { buckets, granularity } = chartBuckets(period, localToday(), firstDay);
  const values = chartValues(days, buckets, granularity);
  const total = values.reduce((sum, v) => sum + v, 0);

  return (
    <View style={styles.container}>
      <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      <StatsChart
        labels={buckets.map((b) => b.label)}
        titles={buckets.map((b) => bucketTitle(b.key))}
        series={[{ id: 'yo', name, color: chartColor(0), values }]}
        type={type}
        onChangeType={setType}
        title={name}
      />
      <Text style={[styles.total, { color: colors.textMuted }]}>
        En este periodo: {formatWithUnit(total, unit)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  total: { fontSize: 14, fontFamily: fonts.detail },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';

import { formatAmount } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

export type ChartType = 'line' | 'bar';

export type ChartSeries = {
  id: string;
  name: string;
  color: string;
  values: number[];
};

type Props = {
  labels: string[];
  series: ChartSeries[];
  type: ChartType;
  onChangeType: (type: ChartType) => void;
  /** Texto cuando no hay ninguna serie elegida. */
  emptyText?: string;
};

const Y_AXIS_WIDTH = 36;
const CHART_HEIGHT = 200;
const MAX_LABELS = 8;

/** Redondea hacia arriba a un número "bonito" para el máximo del eje Y. */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value / 4) ?? 10;
  return Math.ceil(value / (step * magnitude)) * step * magnitude;
}

/**
 * Gráfica de evolución: una línea (o grupo de barras) por contador, cada uno de su color.
 * Eje X: tiempo; eje Y: cantidad. Un periodo que quede en negativo por un −1 se dibuja en 0.
 */
export function StatsChart({
  labels,
  series,
  type,
  onChangeType,
  emptyText = 'Toca un contador para verlo en la gráfica',
}: Props) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();

  if (series.length === 0) {
    return (
      <View
        style={[
          styles.card,
          styles.emptyCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.empty, { color: colors.textMuted }]}>{emptyText}</Text>
      </View>
    );
  }

  // Ancho útil: pantalla − márgenes de la pestaña y la tarjeta − eje Y.
  const plotWidth = width - 32 - 24 - Y_AXIS_WIDTH;
  const points = Math.max(labels.length, 1);
  // Con muchos puntos (p. ej. 31 días) solo se rotula uno de cada `step`.
  const step = Math.ceil(points / MAX_LABELS);
  const shownLabel = (i: number) => (i % step === 0 ? (labels[i] ?? '') : '');
  const clamp = (v: number) => Math.max(0, v);
  const maxValue = niceMax(Math.max(...series.flatMap((s) => s.values.map(clamp)), 0));
  const labelStyle = { color: colors.textMuted, fontSize: 10, fontFamily: fonts.detail };

  const description = series
    .map((s) => `${s.name}: ${formatAmount(s.values.reduce((a, b) => a + b, 0))}`)
    .join(', ');

  let chart;
  if (type === 'line') {
    const spacing = points > 1 ? plotWidth / (points - 1) - 1 : plotWidth;
    chart = (
      <LineChart
        dataSet={series.map((s) => ({
          data: s.values.map((value, i) => ({ value: clamp(value), label: shownLabel(i) })),
          color: s.color,
          dataPointsColor: s.color,
          thickness: 2.5,
          dataPointsRadius: points > 15 ? 2 : 3.5,
        }))}
        width={plotWidth}
        height={CHART_HEIGHT}
        spacing={spacing}
        initialSpacing={6}
        endSpacing={6}
        maxValue={maxValue}
        noOfSections={4}
        yAxisLabelWidth={Y_AXIS_WIDTH}
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor={colors.border}
        rulesColor={colors.border}
        yAxisTextStyle={labelStyle}
        xAxisLabelTextStyle={labelStyle}
        formatYLabel={(label) => formatAmount(Number(label))}
        disableScroll
        isAnimated
      />
    );
  } else {
    // Barras agrupadas: en cada punto del eje X, una barra por contador.
    const groupGap = points > 15 ? 4 : 10;
    const barWidth = Math.max(3, (plotWidth / points - groupGap) / series.length - 1);
    const data = labels.flatMap((_, i) =>
      series.map((s, j) => ({
        value: clamp(s.values[i] ?? 0),
        frontColor: s.color,
        spacing: j === series.length - 1 ? groupGap : 1,
        label: j === 0 ? shownLabel(i) : '',
        labelWidth: (barWidth + 1) * series.length + groupGap,
      })),
    );
    chart = (
      <BarChart
        data={data}
        width={plotWidth}
        height={CHART_HEIGHT}
        barWidth={barWidth}
        initialSpacing={4}
        endSpacing={4}
        maxValue={maxValue}
        noOfSections={4}
        yAxisLabelWidth={Y_AXIS_WIDTH}
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor={colors.border}
        rulesColor={colors.border}
        yAxisTextStyle={labelStyle}
        xAxisLabelTextStyle={labelStyle}
        formatYLabel={(label) => formatAmount(Number(label))}
        barBorderTopLeftRadius={2}
        barBorderTopRightRadius={2}
        disableScroll
        isAnimated
      />
    );
  }

  const nextType: ChartType = type === 'line' ? 'bar' : 'line';
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible={false}
    >
      <View accessible accessibilityLabel={`Gráfica. ${description}`}>
        {chart}
      </View>
      <Pressable
        onPress={() => onChangeType(nextType)}
        accessibilityRole="button"
        accessibilityLabel={nextType === 'bar' ? 'Ver como barras' : 'Ver como líneas'}
        hitSlop={6}
        style={({ pressed }) => [
          styles.toggle,
          { backgroundColor: colors.primarySoft, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons
          name={nextType === 'bar' ? 'bar-chart' : 'trending-up'}
          size={20}
          color={colors.primary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 12, paddingBottom: 48 },
  emptyCard: { paddingBottom: 12, minHeight: 120, justifyContent: 'center' },
  empty: { textAlign: 'center', fontSize: 14, fontFamily: fonts.detail },
  toggle: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

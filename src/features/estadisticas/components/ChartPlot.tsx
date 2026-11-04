import { StyleSheet, Text, View } from 'react-native';
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

export const Y_AXIS_WIDTH = 36;
const MAX_LABELS = 8;

/** Redondea hacia arriba a un número "bonito" para el máximo del eje Y. */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value / 4) ?? 10;
  return Math.ceil(value / (step * magnitude)) * step * magnitude;
}

const clamp = (v: number) => Math.max(0, v);

type PlotProps = {
  labels: string[];
  series: ChartSeries[];
  type: ChartType;
  /** Ancho visible del área de dibujo (sin el eje Y). */
  plotWidth: number;
  height: number;
  /**
   * Vista ampliada: zoom (1 = todo cabe en el ancho; más, se separan los puntos y se desliza),
   * desplazamiento y valores al mantener pulsado.
   */
  interactive?: { zoom: number };
};

/** Bocadillo con los valores del punto que se mantiene pulsado (solo en la vista ampliada). */
function PointerBubble({
  label,
  series,
  index,
}: {
  label: string;
  series: ChartSeries[];
  index: number;
}) {
  const colors = useThemeColors();
  return (
    <View style={[styles.bubble, { backgroundColor: colors.text }]}>
      <Text style={[styles.bubbleTitle, { color: colors.background }]} numberOfLines={1}>
        {label}
      </Text>
      {series.map((s) => (
        <View key={s.id} style={styles.bubbleRow}>
          <View style={[styles.dot, { backgroundColor: s.color }]} />
          <Text style={[styles.bubbleName, { color: colors.background }]} numberOfLines={1}>
            {s.name}
          </Text>
          <Text style={[styles.bubbleValue, { color: colors.background }]}>
            {formatAmount(s.values[index] ?? 0)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** El dibujo de la gráfica (líneas o barras agrupadas), compacto o ampliado. */
export function ChartPlot({ labels, series, type, plotWidth, height, interactive }: PlotProps) {
  const colors = useThemeColors();
  const zoom = interactive?.zoom ?? 1;
  const points = Math.max(labels.length, 1);
  // Con muchos puntos (p. ej. 31 días) solo se rotula uno de cada `step`; al ampliar, más.
  const step = Math.ceil(points / (MAX_LABELS * zoom));
  const shownLabel = (i: number) => (i % step === 0 ? (labels[i] ?? '') : '');
  const maxValue = niceMax(Math.max(...series.flatMap((s) => s.values.map(clamp)), 0));
  const labelStyle = { color: colors.textMuted, fontSize: 10, fontFamily: fonts.detail };
  const bubbleHeight = 34 + series.length * 20;

  // Mantener pulsado (y arrastrar) enseña los valores; deslizar sin más mueve la gráfica.
  const pointerConfig = (bucketOf: (index: number) => number) =>
    interactive
      ? {
          activatePointersOnLongPress: true,
          activatePointersDelay: 200,
          pointerVanishDelay: 2500,
          radius: 5,
          pointerColorsForDataSet: series.map((s) => s.color),
          pointerColor: colors.text,
          pointerStripColor: colors.textMuted,
          pointerStripWidth: 1,
          pointerLabelWidth: 170,
          pointerLabelHeight: bubbleHeight,
          autoAdjustPointerLabelPosition: true,
          pointerLabelComponent: (_items: unknown, _secondary: unknown, index: number) => {
            const bucket = bucketOf(index);
            return <PointerBubble label={labels[bucket] ?? ''} series={series} index={bucket} />;
          },
        }
      : undefined;

  const common = {
    width: plotWidth,
    height,
    maxValue,
    noOfSections: 4,
    yAxisLabelWidth: Y_AXIS_WIDTH,
    yAxisThickness: 0,
    xAxisThickness: 1,
    xAxisColor: colors.border,
    rulesColor: colors.border,
    yAxisTextStyle: labelStyle,
    xAxisLabelTextStyle: labelStyle,
    formatYLabel: (label: string) => formatAmount(Number(label)),
    disableScroll: !interactive,
    // Al ampliar no se repite la animación con cada cambio de zoom.
    isAnimated: !interactive,
  };

  if (type === 'line') {
    const spacing = (points > 1 ? plotWidth / (points - 1) - 1 : plotWidth) * zoom;
    return (
      <LineChart
        {...common}
        dataSet={series.map((s) => ({
          data: s.values.map((value, i) => ({ value: clamp(value), label: shownLabel(i) })),
          color: s.color,
          dataPointsColor: s.color,
          thickness: 2.5,
          dataPointsRadius: points / zoom > 15 ? 2 : 3.5,
        }))}
        spacing={spacing}
        initialSpacing={6}
        endSpacing={interactive ? 24 : 6}
        pointerConfig={pointerConfig((i) => i)}
      />
    );
  }

  // Barras agrupadas: en cada punto del eje X, una barra por serie.
  const groupGap = (points > 15 ? 4 : 10) * Math.sqrt(zoom);
  const barWidth = Math.max(3, ((plotWidth / points - groupGap) / series.length - 1) * zoom);
  const data = labels.flatMap((_, i) =>
    series.map((s, j) => ({
      value: clamp(s.values[i] ?? 0),
      frontColor: s.color,
      spacing: j === series.length - 1 ? groupGap : 1,
      label: j === 0 ? shownLabel(i) : '',
      labelWidth: (barWidth + 1) * series.length + groupGap,
    })),
  );
  return (
    <BarChart
      {...common}
      data={data}
      barWidth={barWidth}
      initialSpacing={4}
      endSpacing={interactive ? 24 : 4}
      barBorderTopLeftRadius={2}
      barBorderTopRightRadius={2}
      // En los datos de barras, cada serie es una barra: el punto del eje X es índice / series.
      pointerConfig={pointerConfig((i) => Math.floor(i / Math.max(series.length, 1)))}
    />
  );
}

const styles = StyleSheet.create({
  bubble: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, gap: 2 },
  bubbleTitle: { fontSize: 13, fontFamily: fonts.title, marginBottom: 2 },
  bubbleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 18 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bubbleName: { flex: 1, fontSize: 12, fontFamily: fonts.detail },
  bubbleValue: { fontSize: 13, fontFamily: fonts.title },
});

import { useState } from 'react';
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
   * Vista ampliada: zoom (1 = todo cabe en el ancho; más, se separan los puntos y se desliza)
   * y un recuadro con el dato al tocar un punto o una barra. `titles` nombra cada punto del eje
   * X entero («mié 4 nov 2026»).
   */
  interactive?: { zoom: number; titles: string[] };
};

const BUBBLE_WIDTH = 150;
const BUBBLE_HEIGHT = 62;

/** Recuadro con el dato concreto que se ha tocado (solo en la vista ampliada). */
function PointBubble({
  title,
  serie,
  value,
}: {
  title: string;
  serie: ChartSeries;
  value: number;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={[styles.bubble, { backgroundColor: colors.text }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${serie.name}, ${title}: ${formatAmount(value)}`}
    >
      <Text style={[styles.bubbleTitle, { color: colors.background }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.bubbleRow}>
        <View style={[styles.dot, { backgroundColor: serie.color }]} />
        <Text style={[styles.bubbleName, { color: colors.background }]} numberOfLines={1}>
          {serie.name}
        </Text>
        <Text style={[styles.bubbleValue, { color: colors.background }]}>
          {formatAmount(value)}
        </Text>
      </View>
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
  // Punto tocado: qué serie y qué posición del eje X. Tocar el mismo otra vez lo cierra.
  const [selected, setSelected] = useState<{ serie: number; index: number } | null>(null);
  const toggle = (serie: number, index: number) =>
    setSelected((cur) => (cur?.serie === serie && cur.index === index ? null : { serie, index }));
  const bubbleFor = (serie: number, index: number) => {
    const s = series[serie];
    if (!s) return null;
    return (
      <PointBubble
        title={interactive?.titles[index] ?? labels[index] ?? ''}
        serie={s}
        value={s.values[index] ?? 0}
      />
    );
  };

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
    const initialSpacing = 6;
    const endSpacing = interactive ? 24 : 6;
    const totalWidth = initialSpacing + spacing * (points - 1) + endSpacing;
    // El recuadro va centrado sobre el punto, sin salirse por los lados ni por arriba.
    const shiftX = (index: number) => {
      const x = initialSpacing + spacing * index;
      const left = Math.min(Math.max(x - BUBBLE_WIDTH / 2, 0), totalWidth - BUBBLE_WIDTH);
      return left - (x - BUBBLE_WIDTH / 2) || 0.01;
    };
    const shiftY = (value: number) =>
      height * (1 - clamp(value) / maxValue) < BUBBLE_HEIGHT + 12 ? 14 : -(BUBBLE_HEIGHT + 12);
    const dataSet = series.map((s, serie) => ({
      data: s.values.map((value, i) => {
        const isSelected = selected?.serie === serie && selected.index === i;
        return {
          value: clamp(value),
          label: shownLabel(i),
          ...(isSelected
            ? {
                dataPointRadius: 6,
                dataPointLabelComponent: () => bubbleFor(serie, i),
                dataPointLabelWidth: BUBBLE_WIDTH,
                dataPointLabelShiftX: shiftX(i),
                dataPointLabelShiftY: shiftY(value),
              }
            : {}),
        };
      }),
      color: s.color,
      dataPointsColor: s.color,
      thickness: 2.5,
      dataPointsRadius: points / zoom > 15 ? 2 : 3.5,
    }));
    return (
      <LineChart
        {...common}
        dataSet={dataSet}
        spacing={spacing}
        initialSpacing={initialSpacing}
        endSpacing={endSpacing}
        // Cada punto del eje X es una franja que se puede tocar; la librería elige la línea
        // más cercana al dedo y nos pasa su dato (lo buscamos en dataSet por identidad).
        focusEnabled={!!interactive}
        onFocus={(item: unknown, index: number) => {
          const serie = dataSet.findIndex((set) => set.data[index] === item);
          if (serie >= 0) toggle(serie, index);
        }}
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
      // Al tocar una barra sale su recuadro encima. En los datos, cada serie es una barra: el
      // punto del eje X es índice / nº de series y la serie, el resto.
      {...(interactive
        ? {
            renderTooltip: (_item: unknown, index: number) =>
              bubbleFor(index % series.length, Math.floor(index / series.length)),
            autoCenterTooltip: true,
          }
        : {})}
    />
  );
}

const styles = StyleSheet.create({
  bubble: {
    width: BUBBLE_WIDTH,
    height: BUBBLE_HEIGHT,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    justifyContent: 'center',
  },
  bubbleTitle: { fontSize: 13, fontFamily: fonts.title, marginBottom: 2 },
  bubbleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 18 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bubbleName: { flex: 1, fontSize: 12, fontFamily: fonts.detail },
  bubbleValue: { fontSize: 13, fontFamily: fonts.title },
});

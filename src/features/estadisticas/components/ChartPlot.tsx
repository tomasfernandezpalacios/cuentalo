import { type ComponentRef, useRef, useState } from 'react';
import { type GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';

import { formatAmount } from '@/lib/format';
import { fonts, inverseColors, useThemeColors } from '@/lib/theme';

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
/** Margen que deja la librería encima del área de dibujo (aprox.), para situar los puntos. */
const PLOT_TOP = 10;
/** Un toque es pulsar y soltar sin moverse más de esto ni tardar más de TAP_MS. */
const TAP_SLOP = 10;
const TAP_MS = 400;

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
  const inverse = inverseColors(useThemeColors());
  return (
    <View
      style={[
        styles.bubble,
        {
          backgroundColor: inverse.backgroundColor,
          borderColor: inverse.borderColor,
          borderWidth: 1,
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${serie.name}, ${title}: ${formatAmount(value)}`}
    >
      <Text style={[styles.bubbleTitle, { color: inverse.color }]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.bubbleRow}>
        <View style={[styles.dot, { backgroundColor: serie.color }]} />
        <Text style={[styles.bubbleName, { color: inverse.color }]} numberOfLines={1}>
          {serie.name}
        </Text>
        <Text style={[styles.bubbleValue, { color: inverse.color }]}>{formatAmount(value)}</Text>
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
  // Para saber qué punto se ha tocado en las líneas: la vista que envuelve la gráfica, cuánto
  // se ha deslizado y dónde empezó el toque (solo se leen en los manejadores de eventos).
  const wrapRef = useRef<ComponentRef<typeof View>>(null);
  const scrollX = useRef(0);
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  // Punto tocado: qué serie y qué posición del eje X. Tocar el mismo otra vez lo cierra.
  // `scroll`: cuánto estaba deslizada la gráfica al tocar (para situar el recuadro).
  const [selected, setSelected] = useState<{
    serie: number;
    index: number;
    scroll: number;
  } | null>(null);
  const toggle = (serie: number, index: number, scroll = 0) =>
    setSelected((cur) =>
      cur?.serie === serie && cur.index === index ? null : { serie, index, scroll },
    );
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

  // La librería no siempre redibuja al cambiar las series (p. ej. al mostrar otro contador) y
  // solo se veía al cambiar de tipo de gráfica. Con esta clave, cualquier cambio de series,
  // valores o periodo vuelve a montar la gráfica y se ve al instante. El zoom no entra: al
  // pellizcar no hace falta (y se perdería el desplazamiento).
  const dataKey = `${labels.join(',')}|${series
    .map((s) => `${s.id}:${s.color}:${s.values.join(',')}`)
    .join('|')}`;

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

  // El recuadro del dato tocado: centrado sobre el punto (x, y), encima si cabe y si no debajo,
  // y siempre dentro de la gráfica (ni por los lados ni por arriba ni por abajo).
  const bubbleAt = (x: number, y: number, serie: number, index: number) => {
    const left = Math.min(
      Math.max(x - BUBBLE_WIDTH / 2, 0),
      Y_AXIS_WIDTH + plotWidth - BUBBLE_WIDTH,
    );
    const above = y - BUBBLE_HEIGHT - 12;
    const top = Math.min(
      Math.max(above >= 0 ? above : y + 14, 0),
      PLOT_TOP + height - BUBBLE_HEIGHT,
    );
    return (
      <View pointerEvents="none" style={[styles.bubbleSpot, { left, top }]}>
        {bubbleFor(serie, index)}
      </View>
    );
  };
  const onScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    scrollX.current = e.nativeEvent.contentOffset.x;
    // Al deslizar, el recuadro se cierra (se quedaría fuera de su punto).
    if (selected) setSelected(null);
  };

  if (type === 'line') {
    const spacing = (points > 1 ? plotWidth / (points - 1) - 1 : plotWidth) * zoom;
    const initialSpacing = 6;
    const endSpacing = interactive ? 24 : 6;
    // El recuadro va centrado sobre el punto, sin salirse por los lados ni por arriba.
    const pointY = (value: number) => PLOT_TOP + height * (1 - clamp(value) / maxValue);

    // Toque en la gráfica de líneas: con la posición del dedo se calcula el punto del eje X más
    // cercano y, de las líneas, la que pasa más cerca en vertical. (Las zonas táctiles de la
    // librería no reciben toques en el móvil.)
    const onTouchStart = (e: GestureResponderEvent) => {
      const { pageX, pageY, timestamp } = e.nativeEvent;
      touchStart.current = { x: pageX, y: pageY, time: timestamp };
    };
    const onTouchEnd = (e: GestureResponderEvent) => {
      const { pageX, pageY, timestamp, touches } = e.nativeEvent;
      const start = touchStart.current;
      const moved = Math.hypot(pageX - start.x, pageY - start.y);
      if (touches.length > 0 || moved > TAP_SLOP || timestamp - start.time > TAP_MS) return;
      wrapRef.current?.measure((_x, _y, _w, _h, left, top) => {
        const contentX = pageX - left - Y_AXIS_WIDTH + scrollX.current - initialSpacing;
        const index = Math.min(points - 1, Math.max(0, Math.round(contentX / spacing)));
        const localY = pageY - top;
        let serie = 0;
        series.forEach((s, j) => {
          const best = series[serie]?.values[index] ?? 0;
          if (Math.abs(pointY(s.values[index] ?? 0) - localY) < Math.abs(pointY(best) - localY)) {
            serie = j;
          }
        });
        toggle(serie, index, scrollX.current);
      });
    };

    // El recuadro, encima del punto (o debajo si no cabe), sin salirse por los lados.
    const bubble = (() => {
      if (!interactive || !selected) return null;
      const value = series[selected.serie]?.values[selected.index];
      if (value === undefined) return null;
      const x = Y_AXIS_WIDTH + initialSpacing + spacing * selected.index - selected.scroll;
      return bubbleAt(x, pointY(value), selected.serie, selected.index);
    })();

    const dataSet = series.map((s, serie) => ({
      data: s.values.map((value, i) => ({
        value: clamp(value),
        label: shownLabel(i),
        // El punto tocado, más grande.
        ...(selected?.serie === serie && selected.index === i ? { dataPointRadius: 6 } : {}),
      })),
      color: s.color,
      dataPointsColor: s.color,
      thickness: 2.5,
      dataPointsRadius: points / zoom > 15 ? 2 : 3.5,
    }));
    const chart = (
      <LineChart
        key={dataKey}
        {...common}
        dataSet={dataSet}
        spacing={spacing}
        initialSpacing={initialSpacing}
        endSpacing={endSpacing}
        onScroll={onScroll}
      />
    );
    if (!interactive) return chart;
    return (
      <View ref={wrapRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {chart}
        {bubble}
      </View>
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
  // Al tocar una barra, el recuadro lo pone la app (el de la librería se salía de la gráfica
  // con barras altas). En los datos cada serie es una barra: el punto del eje X es
  // índice / nº de series y la serie, el resto.
  const n = Math.max(series.length, 1);
  const initialSpacing = 4;
  const groupWidth = n * barWidth + (n - 1) + groupGap;
  const barBubble = (() => {
    if (!interactive || !selected) return null;
    const value = series[selected.serie]?.values[selected.index];
    if (value === undefined) return null;
    const x =
      Y_AXIS_WIDTH +
      initialSpacing +
      selected.index * groupWidth +
      selected.serie * (barWidth + 1) +
      barWidth / 2 -
      selected.scroll;
    return bubbleAt(
      x,
      PLOT_TOP + height * (1 - clamp(value) / maxValue),
      selected.serie,
      selected.index,
    );
  })();
  const barChart = (
    <BarChart
      key={dataKey}
      {...common}
      data={data}
      barWidth={barWidth}
      initialSpacing={initialSpacing}
      endSpacing={interactive ? 24 : 4}
      barBorderTopLeftRadius={2}
      barBorderTopRightRadius={2}
      {...(interactive
        ? {
            onPress: (_item: unknown, index: number) =>
              toggle(index % n, Math.floor(index / n), scrollX.current),
            onScroll,
          }
        : {})}
    />
  );
  if (!interactive) return barChart;
  return (
    <View>
      {barChart}
      {barBubble}
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleSpot: { position: 'absolute' },
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

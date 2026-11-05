import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  type GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { formatAmount } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

import { ChartPlot, type ChartSeries, type ChartType, Y_AXIS_WIDTH } from './ChartPlot';
import { ChartViewer } from './ChartViewer';

export type { ChartSeries, ChartType } from './ChartPlot';

type Props = {
  labels: string[];
  series: ChartSeries[];
  type: ChartType;
  onChangeType: (type: ChartType) => void;
  /** Texto cuando no hay ninguna serie elegida. */
  emptyText?: string;
  /** Título de la vista ampliada. */
  title?: string;
  /** Nombre completo de cada punto del eje X («mié 4 nov 2026»); si no, la etiqueta corta. */
  titles?: string[];
  /** Mantener pulsada la gráfica (en Estadísticas: para reordenar los bloques). */
  onLongPress?: (e: GestureResponderEvent) => void;
  onPressOut?: () => void;
};

const CHART_HEIGHT = 200;

/**
 * Gráfica de evolución: una línea (o grupo de barras) por serie, cada una de su color.
 * Eje X: tiempo; eje Y: cantidad. Un periodo que quede en negativo por un −1 se dibuja en 0.
 * Al tocarla se abre a pantalla completa (`ChartViewer`) para ampliar, deslizar y ver cada dato.
 */
export function StatsChart({
  labels,
  series,
  type,
  onChangeType,
  emptyText = 'Toca un contador para verlo en la gráfica',
  title = 'Evolución',
  titles = labels,
  onLongPress,
  onPressOut,
}: Props) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);

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
  const description = series
    .map((s) => `${s.name}: ${formatAmount(s.values.reduce((a, b) => a + b, 0))}`)
    .join(', ');
  const nextType: ChartType = type === 'line' ? 'bar' : 'line';

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible={false}
    >
      <View>
        <ChartPlot
          labels={labels}
          series={series}
          type={type}
          plotWidth={plotWidth}
          height={CHART_HEIGHT}
        />
        {/* Capa transparente encima: el toque abre la vista ampliada. */}
        <Pressable
          onPress={() => setExpanded(true)}
          onLongPress={onLongPress}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel={`Gráfica. ${description}. Toca para ampliarla`}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Pressable
        onPress={() => setExpanded(true)}
        accessibilityElementsHidden
        importantForAccessibility="no"
        hitSlop={8}
        style={styles.hint}
      >
        <Ionicons name="expand-outline" size={15} color={colors.textMuted} />
        <Text style={[styles.hintText, { color: colors.textMuted }]}>
          Toca la gráfica para ampliarla
        </Text>
      </Pressable>
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
      {expanded ? (
        <ChartViewer
          title={title}
          labels={labels}
          titles={titles}
          series={series}
          type={type}
          onChangeType={onChangeType}
          onClose={() => setExpanded(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 12, paddingBottom: 48 },
  emptyCard: { paddingBottom: 12, minHeight: 120, justifyContent: 'center' },
  empty: { textAlign: 'center', fontSize: 14, fontFamily: fonts.detail },
  hint: {
    position: 'absolute',
    left: 12,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hintText: { fontSize: 13, fontFamily: fonts.detail },
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

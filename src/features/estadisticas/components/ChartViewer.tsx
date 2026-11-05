import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatAmount } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

import { ChartPlot, type ChartSeries, type ChartType, Y_AXIS_WIDTH } from './ChartPlot';

type Props = {
  title: string;
  labels: string[];
  /** Nombre completo de cada punto del eje X, para el recuadro al tocarlo. */
  titles: string[];
  series: ChartSeries[];
  type: ChartType;
  onChangeType: (type: ChartType) => void;
  onClose: () => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

function RoundButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.roundButton,
        { backgroundColor: colors.primarySoft, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.primary} />
    </Pressable>
  );
}

/**
 * Gráfica a pantalla completa: más alta, con zoom con los botones + y −, deslizando con el dedo
 * para moverse por el eje X y tocando un punto (o barra) para ver su dato en un recuadro.
 */
export function ChartViewer({ title, labels, titles, series, type, onChangeType, onClose }: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);

  // Zoom con botones (petición del usuario): cada toque, ×1,5 más o menos.
  const changeZoom = (factor: number) =>
    setZoom((z) => clampZoom(Math.round(z * factor * 10) / 10));

  const plotWidth = width - 32 - 24 - Y_AXIS_WIDTH;
  const chartHeight = Math.max(220, Math.min(height * 0.5, 420));
  const nextType: ChartType = type === 'line' ? 'bar' : 'line';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View
        style={[
          styles.screen,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={10}
            style={styles.back}
          >
            <Ionicons name="arrow-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <RoundButton
            icon={nextType === 'bar' ? 'bar-chart' : 'trending-up'}
            label={nextType === 'bar' ? 'Ver como barras' : 'Ver como líneas'}
            onPress={() => onChangeType(nextType)}
          />
        </View>

        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <ChartPlot
            labels={labels}
            series={series}
            type={type}
            plotWidth={plotWidth}
            height={chartHeight}
            interactive={{ zoom, titles }}
          />
        </View>

        <View style={styles.controls}>
          <RoundButton
            icon="remove"
            label="Reducir"
            onPress={() => changeZoom(1 / 1.5)}
            disabled={zoom <= MIN_ZOOM}
          />
          <Text style={[styles.zoom, { color: colors.textMuted }]}>
            {zoom === 1 ? 'Sin zoom' : `×${formatAmount(zoom)}`}
          </Text>
          <RoundButton
            icon="add"
            label="Ampliar"
            onPress={() => changeZoom(1.5)}
            disabled={zoom >= MAX_ZOOM}
          />
          <RoundButton
            icon="scan-outline"
            label="Ver entera"
            onPress={() => setZoom(1)}
            disabled={zoom === 1}
          />
        </View>

        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Amplía o reduce con los botones, desliza para moverte y toca un punto para ver su dato.
        </Text>

        <View style={styles.legend}>
          {series.map((s) => (
            <View key={s.id} style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: s.color }]} />
              <Text style={[styles.legendName, { color: colors.text }]} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={[styles.legendTotal, { color: colors.text }]}>
                {formatAmount(s.values.reduce((sum, v) => sum + v, 0))}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  title: { flex: 1, fontSize: 20, fontFamily: fonts.title },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, overflow: 'hidden' },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  zoom: { minWidth: 64, textAlign: 'center', fontSize: 14, fontFamily: fonts.detail },
  hint: { fontSize: 13, fontFamily: fonts.detail, textAlign: 'center' },
  legend: { gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontSize: 15, fontFamily: fonts.title },
  legendTotal: { fontSize: 15, fontFamily: fonts.title },
});

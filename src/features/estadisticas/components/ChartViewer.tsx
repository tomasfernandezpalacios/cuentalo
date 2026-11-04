import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, useEffect, useState } from 'react';
import {
  type GestureResponderEvent,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
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

/** Distancia entre los dos dedos de un pellizco (0 si no hay dos). */
function touchDistance(event: GestureResponderEvent): number {
  const [a, b] = event.nativeEvent.touches;
  if (!a || !b) return 0;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

/**
 * Pellizco con dos dedos sobre la gráfica (sin librerías de gestos): cambia el zoom según cuánto
 * se separan los dedos. Con un dedo no hace nada y la gráfica se desliza como siempre.
 */
function createPinch(onZoom: (zoom: number) => void) {
  let zoom = 1;
  let startDistance = 0;
  let startZoom = 1;
  const twoFingers = (e: GestureResponderEvent) => e.nativeEvent.touches.length >= 2;
  const responder = PanResponder.create({
    onStartShouldSetPanResponderCapture: twoFingers,
    onMoveShouldSetPanResponderCapture: twoFingers,
    onPanResponderGrant: (e) => {
      startDistance = touchDistance(e);
      startZoom = zoom;
    },
    onPanResponderMove: (e) => {
      const distance = touchDistance(e);
      if (distance === 0) return;
      if (startDistance === 0) {
        startDistance = distance;
        startZoom = zoom;
        return;
      }
      // Redondeado a 0,1 para no repintar la gráfica con cada píxel.
      const next = clampZoom(Math.round(((startZoom * distance) / startDistance) * 10) / 10);
      if (next !== zoom) {
        zoom = next;
        onZoom(next);
      }
    },
    onPanResponderRelease: () => {
      startDistance = 0;
    },
    onPanResponderTerminationRequest: () => false,
  });
  return {
    panHandlers: responder.panHandlers,
    /** Mantiene el zoom al día cuando cambia con los botones. */
    sync: (value: number) => {
      zoom = value;
    },
  };
}

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
 * Gráfica a pantalla completa: más alta, con zoom pellizcando con dos dedos, deslizando para
 * moverse por el eje X y tocando un punto (o barra) para ver su dato en un recuadro.
 */
export function ChartViewer({ title, labels, titles, series, type, onChangeType, onClose }: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);

  // El gesto guarda su propio estado (fuera de React) y avisa con setZoom.
  const [pinch] = useState(() => createPinch(setZoom));
  useEffect(() => pinch.sync(zoom), [pinch, zoom]);

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
          {...pinch.panHandlers}
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

        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Pellizca con dos dedos para ampliar o reducir, desliza para moverte y toca un punto para
          ver su dato.
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
  hint: { fontSize: 13, fontFamily: fonts.detail, textAlign: 'center' },
  legend: { gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontSize: 15, fontFamily: fonts.title },
  legendTotal: { fontSize: 15, fontFamily: fonts.title },
});

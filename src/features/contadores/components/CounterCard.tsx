import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useEffect, useState } from 'react';
import { type GestureResponderEvent, StyleSheet, Text, View } from 'react-native';

import { withAlpha } from '@/lib/color';
import { formatAmount, formatWithUnit } from '@/lib/format';
import { displayFont, fonts, isCinema, serifWeight, shape, useThemeColors } from '@/lib/theme';

import type { CounterWithTotal } from '../api';

import { CounterAvatar } from './CounterAvatar';

import { QuickAddBar } from './QuickAddBar';
import { Tappable } from '@/components/Tappable';

type Props = {
  counter: CounterWithTotal;
  onPress: () => void;
  onAdd: (amount: number) => void;
  onRemoveOne: () => void;
  /** Mantener pulsado el primer botón (+1) abre la cantidad personalizada. */
  onCustomAdd: () => void;
  /**
   * Mantener pulsada la tarjeta (en la lista de inicio: entra en modo selección y, si después se
   * arrastra, la cambia de sitio).
   */
  onLongPress?: (e: GestureResponderEvent) => void;
  onPressOut?: () => void;
  /** Modo selección: en vez de los botones rápidos se ve si está elegida. */
  selectionMode?: boolean;
  selected?: boolean;
  /** Bloque cuadrado de la cuadrícula (dos por fila) en vez de fila. */
  grid?: boolean;
};

/** Tarjeta de la lista: emoticono · nombre · botones rápidos y −1 · total. */
export function CounterCard({
  counter,
  onPress,
  onAdd,
  onRemoveOne,
  onCustomAdd,
  onLongPress,
  onPressOut,
  selectionMode = false,
  selected = false,
  grid = false,
}: Props) {
  const colors = useThemeColors();
  const subtitle = [
    counter.linkedGroups.length > 0
      ? `👥 ${counter.linkedGroups.map((g) => g.group.name).join(' · ')}`
      : null,
    counter.is_common ? 'Común' : null,
    counter.hidden ? 'Oculto' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  // En los bloques, cuantas más cosas lleva (unidad, línea de grupos) más se compacta todo, para
  // que quepa sin cambiar el tamaño del bloque.
  const level = GRID_SIZES[(counter.unit ? 1 : 0) + (subtitle ? 1 : 0)] ?? GRID_SIZES[0];
  // Icono y total, lo más grandes que quepan en el hueco que dejan los demás (como mucho, los de
  // un contador sencillo). Hasta medirlo, los del nivel.
  const [cardInner, setCardInner] = useState(0);
  const [nameBlock, setNameBlock] = useState(0);
  const topSize =
    grid && cardInner > 0 && nameBlock > 0
      ? gridTopSize(cardInner, nameBlock, counter.unit ? UNIT_LINE : 0, level)
      : level.icon;
  const gridSize = { ...level, ...sizesForTop(topSize) };
  // En la fila, la cifra va tan grande como deja el alto del recuadro (que ocupa toda la fila).
  const [rowBadgeHeight, setRowBadgeHeight] = useState(0);
  const rowFont = rowTotalFont(rowBadgeHeight);
  const canRemove = counter.is_common ? counter.total >= 1 : counter.myGroupTotal >= 1;
  const quickAdd = (
    <QuickAddBar
      compact
      unit={counter.unit}
      onAdd={onAdd}
      onRemoveOne={onRemoveOne}
      canRemove={canRemove}
      onLongPressAdd={onCustomAdd}
      stretch
      buttonHeight={gridSize.buttons}
    />
  );
  const check = (
    <Ionicons
      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
      size={28}
      color={selected ? colors.primary : colors.textMuted}
    />
  );
  const total = (
    <Text
      style={[
        grid
          ? {
              ...displayFont(isCinema ? gridSize.font : gridSize.font - 8),
              lineHeight: isCinema ? gridSize.font + 4 : gridSize.font - 4,
            }
          : {
              // Misma letra que en los bloques, para que se vean igual.
              ...displayFont(isCinema ? rowFont : rowFont - 8),
              lineHeight: isCinema ? rowFont + 4 : rowFont - 4,
            },
        styles.centered,
        { color: colors.primary, ...serifWeight(colors.primary) },
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
      maxFontSizeMultiplier={1.3}
    >
      {/* En un compartido la tarjeta muestra lo mío; el total del grupo está en el detalle. */}
      {formatAmount(counter.displayTotal)}
    </Text>
  );
  // El total, dentro de un recuadro del color de la app para que destaque (petición del usuario).
  const totalBadge = (
    <View
      style={[
        styles.badge,
        grid
          ? [styles.gridBadge, { height: gridSize.badge, minWidth: gridSize.badge + 16 }]
          : styles.rowBadge,
        {
          backgroundColor: colors.primarySoft,
          borderColor: isCinema ? withAlpha(colors.primary, 0.35) : colors.primary,
        },
      ]}
      onLayout={grid ? undefined : (e) => setRowBadgeHeight(e.nativeEvent.layout.height)}
    >
      {total}
    </View>
  );
  // Racha del contador junto al nombre, solo si he marcado «Mostrar racha» en él.
  const streak = counter.showStreak ? (
    <NameStreak days={counter.streak.current} todayDone={counter.streak.todayDone} />
  ) : null;
  const unit = counter.unit ? (
    <Text style={[styles.unit, styles.unitTight, { color: colors.textMuted }]} numberOfLines={1}>
      {counter.unit}
    </Text>
  ) : null;
  return (
    <View>
      <Tappable
        onPress={onPress}
        onLongPress={onLongPress}
        // Antes 500 ms (lo de serie): levantar la tarjeta para moverla se hacía de rogar.
        delayLongPress={280}
        onPressOut={onPressOut}
        accessibilityRole={selectionMode ? 'checkbox' : 'button'}
        accessibilityState={selectionMode ? { checked: selected } : undefined}
        accessibilityLabel={`${counter.name}${counter.group ? `, del grupo ${counter.group.name}` : ''}: ${formatWithUnit(counter.displayTotal, counter.unit)}`}
        accessibilityHint={
          selectionMode ? undefined : 'Abre el contador. Mantén pulsado para seleccionar'
        }
        onLayout={
          grid
            ? (e) =>
                setCardInner(
                  e.nativeEvent.layout.height - 2 * GRID_PADDING - 2 * (selected ? 2 : 1),
                )
            : undefined
        }
        style={({ pressed }) => [
          grid ? [styles.gridCard, { gap: gridSize.gap }] : styles.card,
          {
            backgroundColor: selected ? colors.primarySoft : colors.surface,
            borderColor: selected ? colors.primary : colors.border,
            borderWidth: selected ? 2 : 1,
            opacity: counter.hidden ? 0.6 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {grid ? (
          <>
            {/* Arriba: icono y total, siempre centrados entre sí (la unidad va en su propia
                línea debajo, así no los descuadra). Después: nombre, sus grupos y los botones. */}
            <View>
              <View style={styles.gridTop}>
                <CounterAvatar
                  emoji={counter.emoji}
                  name={counter.name}
                  photoPath={counter.photo_path}
                  // Grande en los bloques (petición del usuario); menor si hay más cosas.
                  size={gridSize.icon}
                />
                <View style={styles.gridTotalBox}>{totalBadge}</View>
              </View>
              {unit ? <View style={styles.gridUnit}>{unit}</View> : null}
            </View>
            <GridName
              name={counter.name}
              subtitle={subtitle}
              streak={streak}
              onNaturalHeight={setNameBlock}
            />
            {selectionMode ? <View style={styles.gridCheck}>{check}</View> : quickAdd}
          </>
        ) : (
          <>
            <CounterAvatar
              emoji={counter.emoji}
              name={counter.name}
              photoPath={counter.photo_path}
              size={50}
            />
            {/* Fila (petición del usuario): arriba el nombre (una línea) con la racha y los
                grupos a su derecha; debajo los botones, achatados y a todo lo ancho. A la
                derecha de todo, el total y la unidad debajo. */}
            <View style={styles.name}>
              <View style={styles.nameRow}>
                <Text
                  style={[
                    styles.nameText,
                    styles.rowNameText,
                    styles.nameShrink,
                    { color: colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {counter.name}
                </Text>
                {streak}
                {subtitle ? (
                  <Text
                    style={[styles.unit, styles.rowSubtitle, { color: colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {selectionMode ? null : (
                <QuickAddBar
                  compact
                  unit={counter.unit}
                  onAdd={onAdd}
                  onRemoveOne={onRemoveOne}
                  canRemove={canRemove}
                  onLongPressAdd={onCustomAdd}
                  // Repartidos a lo ancho: ocupan todo el hueco entre el icono y el total.
                  stretch
                  buttonHeight={ROW_BUTTON_HEIGHT}
                />
              )}
            </View>
            {selectionMode ? check : null}
            <View style={styles.totalBox}>
              {totalBadge}
              {unit}
            </View>
          </>
        )}
      </Tappable>
    </View>
  );
}

/**
 * Nombre (y grupos) de un bloque de la cuadrícula, en el hueco que dejan el icono, el total y los
 * botones. El cuadrado tiene alto fijo: en móviles estrechos o con la letra del sistema grande no
 * siempre cabe todo, y antes la línea de los grupos se salía por encima de los botones. Ahora el
 * hueco recorta lo que sobra y la línea de los grupos solo sale si cabe entera.
 */
function GridName({
  name,
  subtitle,
  streak,
  onNaturalHeight,
}: {
  name: string;
  subtitle: string;
  streak: ReactNode;
  /** Lo que ocupan nombre y grupos sin recortar (para agrandar el icono si sobra sitio). */
  onNaturalHeight: (height: number) => void;
}) {
  const colors = useThemeColors();
  const [space, setSpace] = useState(0);
  const [nameHeight, setNameHeight] = useState(0);
  const [subtitleHeight, setSubtitleHeight] = useState(0);
  const fits = space > 0 && nameHeight + 2 + subtitleHeight <= space;
  const natural = nameHeight > 0 ? nameHeight + (subtitle ? 2 + subtitleHeight : 0) : 0;
  useEffect(() => {
    if (natural > 0) onNaturalHeight(Math.ceil(natural));
  }, [natural, onNaturalHeight]);
  return (
    <View style={styles.gridName} onLayout={(e) => setSpace(e.nativeEvent.layout.height)}>
      {/* Con el icono grande, si hay línea de grupos el nombre ocupa una sola línea para que
          todo quepa en el cuadrado. */}
      <View style={styles.nameRow} onLayout={(e) => setNameHeight(e.nativeEvent.layout.height)}>
        <Text
          style={[
            styles.nameText,
            styles.nameShrink,
            subtitle ? styles.gridNameTight : null,
            { color: colors.text },
          ]}
          numberOfLines={subtitle ? 1 : 2}
        >
          {name}
        </Text>
        {streak}
      </View>
      {subtitle ? (
        <Text
          style={[
            styles.unit,
            styles.gridSubtitle,
            { color: colors.textMuted },
            !fits && styles.measuring,
          ]}
          numberOfLines={1}
          onLayout={(e) => setSubtitleHeight(e.nativeEvent.layout.height)}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** Llama y días de racha del contador (en color si hoy ya se ha mantenido; si no, en gris). */
function NameStreak({ days, todayDone }: { days: number; todayDone: boolean }) {
  const colors = useThemeColors();
  const color = todayDone ? colors.flame : colors.textMuted;
  return (
    <View
      style={styles.streak}
      accessible
      accessibilityLabel={`Racha de ${days} ${days === 1 ? 'día' : 'días'}${todayDone ? '' : ', hoy aún sin mantener'}`}
    >
      <Ionicons name="flame" size={15} color={color} />
      <Text maxFontSizeMultiplier={1.2} style={[styles.streakText, { color }]}>
        {days}
      </Text>
    </View>
  );
}

/** Alto del recuadro del total: en la fila y en los bloques. */
const BADGE = 40;
/** Alto de los botones en la fila: más bajos que los de serie (48) para que la fila sea achatada. */
const ROW_BUTTON_HEIGHT = 34;

/**
 * Letra del total en la fila según el alto de su recuadro (el ancho lo corrige
 * `adjustsFontSizeToFit` si hay muchas cifras). Como mucho, la de un contador sencillo en los
 * bloques (petición del usuario), así las dos vistas se ven del mismo tamaño. Hasta medirlo, 28.
 */
function rowTotalFont(badgeHeight: number): number {
  if (badgeHeight <= 0) return 28;
  return Math.max(24, Math.min(GRID_SIZES[0].font, Math.round(badgeHeight * 0.72)));
}
const GRID_BADGE = 46;
/**
 * Tamaños de un bloque de la cuadrícula según cuántas cosas extra lleva (0: ninguna; 1: unidad o
 * línea de grupos; 2: las dos). Icono, alto del recuadro del total, letra del total, alto de los
 * botones y hueco entre filas. El bloque mide siempre lo mismo: lo de dentro se encoge.
 */
/** Relleno del bloque, alto de la línea de la unidad y lo más pequeño que se hace el icono. */
const GRID_PADDING = 12;
const UNIT_LINE = 14;
const MIN_TOP = 34;

type GridLevel = (typeof GRID_SIZES)[number];

/**
 * Tamaño del icono en un bloque: el hueco que queda tras la unidad, el nombre (con sus grupos),
 * los botones y los huecos entre filas, entre MIN_TOP y el de un contador sencillo.
 */
function gridTopSize(inner: number, nameBlock: number, unitLine: number, level: GridLevel) {
  const free = inner - unitLine - nameBlock - level.buttons - 2 * level.gap;
  return Math.max(MIN_TOP, Math.min(GRID_SIZES[0].icon, Math.floor(free)));
}

/** Icono, recuadro y letra del total en proporción (los de un contador sencillo para 52). */
function sizesForTop(top: number) {
  const base = GRID_SIZES[0];
  return {
    icon: top,
    badge: Math.round((top * base.badge) / base.icon),
    font: Math.round((top * base.font) / base.icon),
  };
}

const GRID_SIZES = [
  { icon: 52, badge: GRID_BADGE, font: 34, buttons: 44, gap: 4 },
  { icon: 46, badge: 42, font: 31, buttons: 40, gap: 3 },
  { icon: 40, badge: 38, font: 28, buttons: 38, gap: 2 },
] as const;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    // Filas altas (petición del usuario): más sitio para el nombre, la unidad y los grupos.
    minHeight: 84,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: shape.card,
    borderWidth: 1,
    gap: 10,
  },
  gridCard: {
    flex: 1,
    aspectRatio: 1,
    padding: GRID_PADDING,
    borderRadius: shape.card,
    borderWidth: 1,
    gap: 4,
    justifyContent: 'space-between',
  },
  gridTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  gridTotalBox: { flex: 1, alignItems: 'flex-end', gap: 2 },
  // Rectángulo que se alarga con las cifras; el número siempre en el centro (en los dos ejes),
  // tenga 1 cifra o 6. El alto lo pone la fila (todo el que hay) o el bloque (fijo).
  badge: {
    minWidth: BADGE + 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridBadge: {
    height: GRID_BADGE,
    minWidth: GRID_BADGE + 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    maxWidth: '100%',
  },
  // Sin el relleno de fuente de Android y con altura de línea ajustada: centrado de verdad.
  centered: { textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false },
  gridUnit: { alignItems: 'flex-end' },
  unitTight: { lineHeight: 14, includeFontPadding: false },
  // Ocupa lo que dejan libre el resto y recorta lo que no quepa (nunca encima de los botones).
  gridName: { flex: 1, minHeight: 0, overflow: 'hidden', justifyContent: 'center', gap: 2 },
  // La línea de grupos que no cabe se sigue midiendo, pero fuera del flujo y sin verse.
  measuring: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  gridCheck: { alignItems: 'flex-end' },
  // Nombre y línea de grupos con la altura de línea justa, para que quepan los dos.
  gridNameTight: { lineHeight: 21, includeFontPadding: false },
  gridSubtitle: { lineHeight: 15, includeFontPadding: false },
  name: { flex: 1, gap: 8 },
  nameText: { fontSize: 17, fontFamily: fonts.title },
  rowNameText: { fontSize: 18 },
  // Los grupos, a la derecha del nombre y la racha: se cortan antes que el nombre.
  rowSubtitle: { flexShrink: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // El nombre se encoge (y corta) antes que la racha.
  nameShrink: { flexShrink: 1 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 1, flexShrink: 0 },
  streakText: { fontSize: 14, fontFamily: fonts.title },
  // En la fila, el total ocupa todo el alto de la tarjeta menos lo que necesita la unidad.
  totalBox: { alignSelf: 'stretch', alignItems: 'center', minWidth: 40, maxWidth: 96, gap: 2 },
  rowBadge: { flex: 1, minHeight: BADGE },
  unit: { fontSize: 12, fontFamily: fonts.detail },
});

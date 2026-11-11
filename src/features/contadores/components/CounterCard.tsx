import Ionicons from '@expo/vector-icons/Ionicons';
import { type GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { withAlpha } from '@/lib/color';
import { formatAmount, formatWithUnit } from '@/lib/format';
import { displayFont, fonts, isCinema, serifWeight, shape, useThemeColors } from '@/lib/theme';

import type { CounterWithTotal } from '../api';

import { CounterAvatar } from './CounterAvatar';
import { TutorialTarget } from '@/features/tutorial/TutorialTarget';

import { QuickAddBar } from './QuickAddBar';

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
  /** Primera tarjeta de la lista: la que ilumina el tutorial (tarjeta y su primer botón). */
  tutorialTarget?: boolean;
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
  tutorialTarget = false,
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
  const quickAdd = (
    <QuickAddBar
      compact
      unit={counter.unit}
      onAdd={onAdd}
      onRemoveOne={onRemoveOne}
      canRemove={counter.is_common ? counter.total >= 1 : counter.myGroupTotal >= 1}
      streak={
        counter.streak
          ? { days: counter.streak.current, todayDone: counter.streak.todayDone }
          : null
      }
      onLongPressAdd={onCustomAdd}
      tutorialTarget={tutorialTarget}
      stretch={grid}
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
        grid ? styles.gridTotal : styles.total,
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
        grid && styles.gridBadge,
        {
          backgroundColor: colors.primarySoft,
          borderColor: isCinema ? withAlpha(colors.primary, 0.35) : colors.primary,
        },
      ]}
    >
      {total}
    </View>
  );
  const unit = counter.unit ? (
    <Text style={[styles.unit, { color: colors.textMuted }]} numberOfLines={1}>
      {counter.unit}
    </Text>
  ) : null;
  return (
    <TutorialTarget id="tarjeta" enabled={tutorialTarget}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressOut={onPressOut}
        accessibilityRole={selectionMode ? 'checkbox' : 'button'}
        accessibilityState={selectionMode ? { checked: selected } : undefined}
        accessibilityLabel={`${counter.name}${counter.group ? `, del grupo ${counter.group.name}` : ''}: ${formatWithUnit(counter.displayTotal, counter.unit)}`}
        accessibilityHint={
          selectionMode ? undefined : 'Abre el contador. Mantén pulsado para seleccionar'
        }
        style={({ pressed }) => [
          grid ? styles.gridCard : styles.card,
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
            {/* Arriba: icono y total. Debajo: nombre, sus grupos y los botones. */}
            <View style={styles.gridTop}>
              <CounterAvatar emoji={counter.emoji} name={counter.name} size={36} />
              <View style={styles.gridTotalBox}>
                {totalBadge}
                {unit}
              </View>
            </View>
            <View style={styles.gridName}>
              <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={2}>
                {counter.name}
              </Text>
              {subtitle ? (
                <Text style={[styles.unit, { color: colors.textMuted }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {selectionMode ? <View style={styles.gridCheck}>{check}</View> : quickAdd}
          </>
        ) : (
          <>
            <CounterAvatar emoji={counter.emoji} name={counter.name} size={42} />
            <View style={styles.name}>
              <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={2}>
                {counter.name}
              </Text>
              {subtitle ? (
                <Text style={[styles.unit, { color: colors.textMuted }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {selectionMode ? check : quickAdd}
            <View style={styles.totalBox}>
              {totalBadge}
              {unit}
            </View>
          </>
        )}
      </Pressable>
    </TutorialTarget>
  );
}

/** Alto del recuadro del total: en la fila y en los bloques. */
const BADGE = 36;
const GRID_BADGE = 46;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: shape.card,
    borderWidth: 1,
    gap: 8,
  },
  gridCard: {
    flex: 1,
    aspectRatio: 1,
    padding: 12,
    borderRadius: shape.card,
    borderWidth: 1,
    gap: 4,
    justifyContent: 'space-between',
  },
  gridTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  gridTotalBox: { flex: 1, alignItems: 'flex-end', gap: 2 },
  // Rectángulo de alto fijo que se alarga con las cifras; el número siempre en el centro (en
  // los dos ejes), tenga 1 cifra o 6.
  badge: {
    height: BADGE,
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
  gridTotal: { ...displayFont(isCinema ? 34 : 26), lineHeight: isCinema ? 38 : 30 },
  gridName: { flex: 1, justifyContent: 'center', gap: 2 },
  gridCheck: { alignItems: 'flex-end' },
  name: { flex: 1, gap: 2 },
  nameText: { fontSize: 17, fontFamily: fonts.title },
  totalBox: { alignItems: 'center', minWidth: 40, maxWidth: 80, gap: 2 },
  total: { ...displayFont(isCinema ? 26 : 21), lineHeight: isCinema ? 30 : 25 },
  unit: { fontSize: 12, fontFamily: fonts.detail },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSettings } from '@/features/configuracion/settings';
import { TutorialTarget } from '@/features/tutorial/TutorialTarget';
import { formatWithUnit } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

// Las cantidades de los botones se eligen en Configuración (por defecto +1 y +5).

type Props = {
  unit: string | null;
  onAdd: (amount: number) => void;
  onRemoveOne: () => void;
  /** Desactiva el -1 cuando no hay nada que restar. */
  canRemove: boolean;
  /** Botón "Otra" para escribir la cantidad (solo en la versión grande). */
  onCustom?: () => void;
  /** Mantener pulsado el primer botón abre la cantidad personalizada (versión compacta). */
  onLongPressAdd?: () => void;
  compact?: boolean;
  /** El primer botón es el que ilumina el tutorial («Suma con un toque»). */
  tutorialTarget?: boolean;
  /**
   * Contador en formato racha (versión compacta): solo el primer botón, el −1 y, en el sitio
   * del −1, los días de racha con la llama (en color si hoy ya se ha mantenido).
   */
  streak?: { days: number; todayDone: boolean } | null;
  /** Como mucho estos botones de sumar (en los bloques de la cuadrícula, uno). */
  maxAmounts?: number;
  /** Versión compacta que ocupa todo el ancho (bloques de la cuadrícula): botones repartidos. */
  stretch?: boolean;
};

/** Botones rápidos (+1 +5 por defecto), −1 y, opcionalmente, "Otra". */
export function QuickAddBar({
  unit,
  onAdd,
  onRemoveOne,
  canRemove,
  onCustom,
  onLongPressAdd,
  compact = false,
  tutorialTarget = false,
  streak = null,
  maxAmounts = Infinity,
  stretch = false,
}: Props) {
  const colors = useThemeColors();
  const { quickAmounts } = useSettings();
  const size = compact ? styles.compact : styles.large;
  const label = compact ? styles.compactLabel : styles.largeLabel;
  const showStreak = compact && streak !== null;
  const amounts = showStreak
    ? quickAmounts.slice(0, 1)
    : quickAmounts.slice(0, Math.min(maxAmounts, quickAmounts.length));
  const targetStyle = compact && !stretch ? undefined : styles.flexTarget;
  const buttonSize = compact
    ? stretch
      ? styles.compactStretch
      : styles.compact
    : styles.largeInTarget;
  const flameColor = streak?.todayDone ? colors.flame : colors.textMuted;

  return (
    <View style={[styles.row, compact && styles.compactRow, stretch && styles.stretchRow]}>
      {amounts.map((amount, index) => (
        <TutorialTarget
          key={amount}
          id="sumar"
          enabled={tutorialTarget && index === 0}
          style={targetStyle}
        >
          <Pressable
            onPress={() => onAdd(amount)}
            onLongPress={index === 0 ? onLongPressAdd : undefined}
            accessibilityRole="button"
            accessibilityLabel={`Añadir ${formatWithUnit(amount, unit)}`}
            accessibilityHint={
              index === 0 && onLongPressAdd ? 'Mantén pulsado para añadir otra cantidad' : undefined
            }
            hitSlop={compact ? 4 : 0}
            style={({ pressed }) => [
              styles.button,
              buttonSize,
              { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text
              maxFontSizeMultiplier={compact ? 1.2 : 1.5}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={[label, { color: colors.onPrimary }]}
            >
              +{amount}
            </Text>
          </Pressable>
        </TutorialTarget>
      ))}
      <TutorialTarget id="restar" enabled={tutorialTarget} style={targetStyle}>
        <Pressable
          onPress={onRemoveOne}
          disabled={!canRemove}
          accessibilityRole="button"
          accessibilityLabel="Restar 1"
          accessibilityHint="Guarda una resta de 1 en el historial"
          accessibilityState={{ disabled: !canRemove }}
          hitSlop={compact ? 4 : 0}
          style={({ pressed }) => [
            styles.button,
            buttonSize,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              opacity: !canRemove ? 0.4 : pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text
            maxFontSizeMultiplier={compact ? 1.2 : 1.5}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={[label, { color: colors.text }]}
          >
            −1
          </Text>
        </Pressable>
      </TutorialTarget>
      {onCustom ? (
        <Pressable
          onPress={onCustom}
          accessibilityRole="button"
          accessibilityLabel="Añadir otra cantidad"
          style={({ pressed }) => [
            styles.button,
            size,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text
            maxFontSizeMultiplier={compact ? 1.2 : 1.5}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={[label, { color: colors.text }]}
          >
            Otra
          </Text>
        </Pressable>
      ) : null}
      {showStreak && streak ? (
        <View
          style={[styles.button, styles.streak, stretch && styles.streakStretch]}
          accessible
          accessibilityLabel={`Racha de ${streak.days} ${streak.days === 1 ? 'día' : 'días'}${streak.todayDone ? '' : ', hoy aún sin mantener'}`}
        >
          <Ionicons name="flame" size={16} color={flameColor} />
          <Text maxFontSizeMultiplier={1.2} style={[styles.compactLabel, { color: flameColor }]}>
            {streak.days}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  flexTarget: { flex: 1 },
  compactRow: { gap: 4 },
  button: { alignItems: 'center', justifyContent: 'center' },
  large: { flex: 1, height: 60, borderRadius: 16 },
  // Los botones de cantidad van dentro de un envoltorio (TutorialTarget) que es quien estira.
  largeInTarget: { height: 60, borderRadius: 16 },
  // En la tarjeta: estrechos para que quepan, pero altos para pulsarlos con comodidad.
  // Ancho mínimo (no fijo): «+100» con letra ancha no cabía en 36 y se cortaba.
  compact: { minWidth: 36, paddingHorizontal: 3, height: 48, borderRadius: 10 },
  compactStretch: { height: 44, borderRadius: 10 },
  stretchRow: { alignSelf: 'stretch' },
  streakStretch: { flex: 1, height: 44 },
  streak: { flexDirection: 'row', height: 48, minWidth: 36, gap: 1, paddingHorizontal: 2 },
  largeLabel: { fontSize: 22, fontFamily: fonts.title },
  compactLabel: { fontSize: 17, fontFamily: fonts.title },
});

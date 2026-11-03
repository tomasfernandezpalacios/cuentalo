import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatWithUnit } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

// La tarjeta de la lista es compacta y solo lleva +1 y +5; el detalle añade +10.
const QUICK_AMOUNTS = [1, 5, 10] as const;
const COMPACT_AMOUNTS = [1, 5] as const;

type Props = {
  unit: string | null;
  onAdd: (amount: number) => void;
  onRemoveOne: () => void;
  /** Desactiva el -1 cuando no hay nada que restar. */
  canRemove: boolean;
  /** Botón "Otra" para escribir la cantidad (solo en la versión grande). */
  onCustom?: () => void;
  /** Mantener pulsado +1 abre la cantidad personalizada (útil en la versión compacta). */
  onLongPressAdd?: () => void;
  compact?: boolean;
};

/** Botones +1 +5 (+10) −1 y, opcionalmente, "Otra". */
export function QuickAddBar({
  unit,
  onAdd,
  onRemoveOne,
  canRemove,
  onCustom,
  onLongPressAdd,
  compact = false,
}: Props) {
  const colors = useThemeColors();
  const size = compact ? styles.compact : styles.large;
  const label = compact ? styles.compactLabel : styles.largeLabel;

  return (
    <View style={[styles.row, compact && styles.compactRow]}>
      {(compact ? COMPACT_AMOUNTS : QUICK_AMOUNTS).map((amount) => (
        <Pressable
          key={amount}
          onPress={() => onAdd(amount)}
          onLongPress={amount === 1 ? onLongPressAdd : undefined}
          accessibilityRole="button"
          accessibilityLabel={`Añadir ${formatWithUnit(amount, unit)}`}
          accessibilityHint={
            amount === 1 && onLongPressAdd ? 'Mantén pulsado para añadir otra cantidad' : undefined
          }
          hitSlop={compact ? 4 : 0}
          style={({ pressed }) => [
            styles.button,
            size,
            { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[label, { color: colors.onPrimary }]}>+{amount}</Text>
        </Pressable>
      ))}
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
          size,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            opacity: !canRemove ? 0.4 : pressed ? 0.75 : 1,
          },
        ]}
      >
        <Text style={[label, { color: colors.text }]}>−1</Text>
      </Pressable>
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
          <Text style={[label, { color: colors.text }]}>Otra</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  compactRow: { gap: 4 },
  button: { alignItems: 'center', justifyContent: 'center' },
  large: { flex: 1, height: 60, borderRadius: 16 },
  compact: { width: 36, height: 36, borderRadius: 10 },
  largeLabel: { fontSize: 19, fontFamily: fonts.title },
  compactLabel: { fontSize: 14, fontFamily: fonts.title },
});

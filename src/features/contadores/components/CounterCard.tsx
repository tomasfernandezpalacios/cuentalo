import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatAmount, formatWithUnit } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

import type { CounterWithTotal } from '../api';

import { QuickAddBar } from './QuickAddBar';

type Props = {
  counter: CounterWithTotal;
  onPress: () => void;
  onAdd: (amount: number) => void;
  onRemoveOne: () => void;
  /** Mantener pulsado +1 abre la cantidad personalizada. */
  onCustomAdd: () => void;
};

/** Tarjeta de la lista: nombre · +1 +5 +10 −1 · total. */
export function CounterCard({ counter, onPress, onAdd, onRemoveOne, onCustomAdd }: Props) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${counter.name}: ${formatWithUnit(counter.total, counter.unit)}`}
      accessibilityHint="Abre el contador"
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: counter.archived ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.name}>
        <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={2}>
          {counter.name}
        </Text>
        {counter.archived ? (
          <Text style={[styles.unit, { color: colors.textMuted }]}>Archivado</Text>
        ) : null}
      </View>

      {counter.archived ? null : (
        <QuickAddBar
          compact
          unit={counter.unit}
          onAdd={onAdd}
          onRemoveOne={onRemoveOne}
          canRemove={counter.total > 0}
          onLongPressAdd={onCustomAdd}
        />
      )}

      <View style={styles.totalBox}>
        <Text
          style={[styles.total, { color: colors.primary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatAmount(counter.total)}
        </Text>
        {counter.unit ? (
          <Text style={[styles.unit, { color: colors.textMuted }]} numberOfLines={1}>
            {counter.unit}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  name: { flex: 1, gap: 2 },
  nameText: { fontSize: 19, fontFamily: fonts.title },
  totalBox: { alignItems: 'flex-end', minWidth: 44, maxWidth: 76 },
  total: { fontSize: 22, fontFamily: fonts.title },
  unit: { fontSize: 12, fontFamily: fonts.detail },
});

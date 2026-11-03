import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatAmount, formatWithUnit } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

import type { CounterWithTotal } from '../api';

import { CounterAvatar } from './CounterAvatar';
import { QuickAddBar } from './QuickAddBar';

type Props = {
  counter: CounterWithTotal;
  onPress: () => void;
  onAdd: (amount: number) => void;
  onRemoveOne: () => void;
  /** Mantener pulsado +1 abre la cantidad personalizada. */
  onCustomAdd: () => void;
};

/** Tarjeta de la lista: emoticono · nombre · +1 +5 −1 · total. */
export function CounterCard({ counter, onPress, onAdd, onRemoveOne, onCustomAdd }: Props) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${counter.name}${counter.group ? `, del grupo ${counter.group.name}` : ''}: ${formatWithUnit(counter.displayTotal, counter.unit)}`}
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
      <CounterAvatar emoji={counter.emoji} name={counter.name} size={42} />
      <View style={styles.name}>
        <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={2}>
          {counter.name}
        </Text>
        {counter.group || counter.archived ? (
          <Text style={[styles.unit, { color: colors.textMuted }]} numberOfLines={1}>
            {[
              counter.group ? `👥 ${counter.group.name}` : null,
              counter.is_common ? 'Común' : null,
              counter.archived ? 'Archivado' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
      </View>

      {counter.archived ? null : (
        <QuickAddBar
          compact
          unit={counter.unit}
          onAdd={onAdd}
          onRemoveOne={onRemoveOne}
          canRemove={counter.is_common ? counter.total >= 1 : counter.myTotal >= 1}
          onLongPressAdd={onCustomAdd}
        />
      )}

      <View style={styles.totalBox}>
        <Text
          style={[styles.total, { color: colors.primary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.3}
        >
          {/* En un compartido la tarjeta muestra lo mío; el total del grupo está en el detalle. */}
          {formatAmount(counter.displayTotal)}
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
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  name: { flex: 1, gap: 2 },
  nameText: { fontSize: 17, fontFamily: fonts.title },
  totalBox: { alignItems: 'flex-end', minWidth: 36, maxWidth: 64 },
  total: { fontSize: 21, fontFamily: fonts.title },
  unit: { fontSize: 12, fontFamily: fonts.detail },
});

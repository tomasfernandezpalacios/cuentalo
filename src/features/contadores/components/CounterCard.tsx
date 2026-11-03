import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatAmount, pluralize } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';

import type { CounterWithTotal } from '../api';

type Props = {
  counter: CounterWithTotal;
  onPress: () => void;
  /** Botón +1 en la propia tarjeta; manteniéndolo pulsado se pide otra cantidad. */
  onQuickAdd?: () => void;
  onCustomAdd?: () => void;
};

export function CounterCard({ counter, onPress, onQuickAdd, onCustomAdd }: Props) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${counter.name}: ${formatAmount(counter.total)} ${counter.unit}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: counter.archived ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {counter.name}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {counter.archived ? 'Archivado · ' : ''}
          {pluralize(counter.entryCount, 'registro', 'registros')}
        </Text>
      </View>
      <View style={styles.totalBox}>
        <Text style={[styles.total, { color: colors.primary }]}>{formatAmount(counter.total)}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          {counter.unit}
        </Text>
      </View>
      {onQuickAdd ? (
        <Pressable
          onPress={onQuickAdd}
          onLongPress={onCustomAdd}
          accessibilityRole="button"
          accessibilityLabel={`Añadir 1 a ${counter.name}`}
          accessibilityHint="Mantén pulsado para añadir otra cantidad"
          hitSlop={6}
          style={({ pressed }) => [
            styles.quickAdd,
            { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.quickAddLabel, { color: colors.onPrimary }]}>+1</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 17, fontWeight: '600' },
  meta: { fontSize: 13 },
  totalBox: { alignItems: 'flex-end', maxWidth: '35%' },
  total: { fontSize: 24, fontWeight: '800' },
  quickAdd: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddLabel: { fontSize: 17, fontWeight: '700' },
});

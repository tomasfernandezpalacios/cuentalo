import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatAmount, pluralize } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';

import type { CounterWithTotal } from '../api';

type Props = {
  counter: CounterWithTotal;
  onPress: () => void;
};

export function CounterCard({ counter, onPress }: Props) {
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
  totalBox: { alignItems: 'flex-end', maxWidth: '40%' },
  total: { fontSize: 24, fontWeight: '800' },
});

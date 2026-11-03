import { StyleSheet, Text, View } from 'react-native';

import { formatWithUnit } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

export type ChartTotal = {
  id: string;
  name: string;
  emoji: string | null;
  unit: string | null;
  color: string;
  total: number;
};

/** Debajo de la gráfica: el total de cada contador que se está viendo, con su color. */
export function ChartTotals({ totals }: { totals: ChartTotal[] }) {
  const colors = useThemeColors();
  if (totals.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {totals.map((t, i) => (
        <View
          key={t.id}
          accessible
          accessibilityLabel={`${t.name}: ${formatWithUnit(t.total, t.unit)}`}
          style={[
            styles.row,
            i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: t.color }]} />
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {t.emoji ? `${t.emoji} ${t.name}` : t.name}
          </Text>
          <Text style={[styles.total, { color: colors.text }]} numberOfLines={1}>
            {formatWithUnit(t.total, t.unit)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { flex: 1, fontSize: 16, fontFamily: fonts.title },
  total: { fontSize: 18, fontFamily: fonts.title, maxWidth: '50%' },
});

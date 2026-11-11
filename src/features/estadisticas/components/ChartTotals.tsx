import { StyleSheet, Text, View } from 'react-native';

import type { CounterGroup } from '@/features/contadores/api';
import { GroupAvatar } from '@/features/social/components/GroupAvatar';
import { formatWithUnit } from '@/lib/format';
import { fonts, shape, useThemeColors } from '@/lib/theme';

export type ChartTotal = {
  id: string;
  name: string;
  emoji: string | null;
  unit: string | null;
  color: string;
  total: number;
  /** Grupos en los que cuenta (vacío si es individual). */
  groups: CounterGroup[];
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
          accessibilityLabel={`${t.name}${t.groups.length > 0 ? `, de ${t.groups.map((g) => g.name).join(' y ')}` : ''}: ${formatWithUnit(t.total, t.unit)}`}
          style={[
            styles.row,
            i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: t.color }]} />
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {t.emoji ? `${t.emoji} ${t.name}` : t.name}
            </Text>
            {/* Imagen de cada grupo en el que cuenta, después del nombre. */}
            {t.groups.map((g) => (
              <GroupAvatar key={g.id} emoji={g.emoji} photoPath={g.photoPath} size={22} />
            ))}
          </View>
          <Text style={[styles.total, { color: colors.text }]} numberOfLines={1}>
            {formatWithUnit(t.total, t.unit)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: shape.card, borderWidth: 1, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  nameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 16, fontFamily: fonts.title },
  total: { fontSize: 18, fontFamily: fonts.title, maxWidth: '50%' },
});

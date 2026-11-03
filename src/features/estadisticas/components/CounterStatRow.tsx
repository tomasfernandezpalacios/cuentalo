import { StyleSheet, Text, View } from 'react-native';

import { formatAmount, pluralize } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';

type Props = {
  name: string;
  unit: string;
  total: number;
  entryCount: number;
  /** Posición en el ranking de más usados (opcional). */
  rank?: number;
};

export function CounterStatRow({ name, unit, total, entryCount, rank }: Props) {
  const colors = useThemeColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]} accessible>
      {rank !== undefined ? (
        <Text style={[styles.rank, { color: colors.primary }]}>{rank}</Text>
      ) : null}
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>
          {pluralize(entryCount, 'registro', 'registros')}
        </Text>
      </View>
      <Text style={[styles.total, { color: colors.text }]} numberOfLines={1}>
        {formatAmount(total)} {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rank: { fontSize: 18, fontWeight: '800', width: 20, textAlign: 'center' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600' },
  total: { fontSize: 16, fontWeight: '700', maxWidth: '45%' },
});

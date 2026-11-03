import { StyleSheet, Text, View } from 'react-native';

import { formatAmount } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';

type Props = { label: string; value: number };

export function StatTile({ label, value }: Props) {
  const colors = useThemeColors();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${formatAmount(value)}`}
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.value, { color: colors.text }]}>{formatAmount(value)}</Text>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, gap: 2 },
  value: { fontSize: 26, fontWeight: '800' },
  label: { fontSize: 13 },
});

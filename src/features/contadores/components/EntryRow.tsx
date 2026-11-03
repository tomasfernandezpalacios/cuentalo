import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateTime, formatWithUnit } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';

import type { Entry } from '../api';

type Props = {
  entry: Entry;
  unit: string | null;
  onPress: () => void;
};

export function EntryRow({ entry, unit, onPress }: Props) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Editar o borrar el registro"
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.info}>
        <Text style={{ color: colors.text, fontSize: 15 }}>{formatDateTime(entry.logged_at)}</Text>
        {entry.note ? (
          <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={2}>
            {entry.note}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.amount, { color: colors.text }]}>
        +{formatWithUnit(entry.amount, unit)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  info: { flex: 1, gap: 2 },
  amount: { fontSize: 16, fontWeight: '600' },
});

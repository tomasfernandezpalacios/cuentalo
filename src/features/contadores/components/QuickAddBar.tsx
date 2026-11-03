import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/lib/theme';

const QUICK_AMOUNTS = [1, 5, 10] as const;

type Props = {
  unit: string;
  onAdd: (amount: number) => void;
  onCustom: () => void;
};

export function QuickAddBar({ unit, onAdd, onCustom }: Props) {
  const colors = useThemeColors();
  return (
    <View style={styles.row}>
      {QUICK_AMOUNTS.map((amount) => (
        <Pressable
          key={amount}
          onPress={() => onAdd(amount)}
          accessibilityRole="button"
          accessibilityLabel={`Añadir ${amount} ${unit}`}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.label, { color: colors.onPrimary }]}>+{amount}</Text>
        </Pressable>
      ))}
      <Pressable
        onPress={onCustom}
        accessibilityRole="button"
        accessibilityLabel="Añadir otra cantidad"
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Text style={[styles.label, { color: colors.text }]}>Otra</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 20, fontWeight: '700' },
});

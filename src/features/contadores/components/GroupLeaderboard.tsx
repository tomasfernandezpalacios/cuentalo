import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

import { useCounterList, useMyLastCounterId } from '../hooks';

import { Leaderboard } from './Leaderboard';

/**
 * Clasificación del grupo con un selector de contador. Por defecto muestra el último contador
 * del grupo en el que el usuario ha registrado algo; si no ha registrado en ninguno, el primero.
 */
export function GroupLeaderboard({ groupId }: { groupId: string }) {
  const colors = useThemeColors();
  const counters = useCounterList();
  const groupCounters = (counters.data ?? []).filter(
    (c) => c.group_id === groupId && c.isActive && !c.archived,
  );
  const lastUsed = useMyLastCounterId(groupCounters.map((c) => c.id));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (groupCounters.length === 0) {
    return (
      <Text style={[styles.empty, { color: colors.textMuted }]}>
        Cuando el grupo tenga contadores compartidos, aquí veréis quién va ganando.
      </Text>
    );
  }

  // Esperamos a saber cuál usé por última vez para no saltar de un contador a otro.
  if (selectedId === null && lastUsed.isPending) {
    return <ActivityIndicator color={colors.primary} />;
  }

  const selected =
    groupCounters.find((c) => c.id === selectedId) ??
    groupCounters.find((c) => c.id === lastUsed.data) ??
    groupCounters[0];
  if (!selected) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {groupCounters.map((counter) => {
          const isSelected = counter.id === selected.id;
          return (
            <Pressable
              key={counter.id}
              onPress={() => setSelectedId(counter.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Clasificación de ${counter.name}`}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[styles.chipText, { color: isSelected ? colors.onPrimary : colors.text }]}
              >
                {counter.emoji ? `${counter.emoji} ${counter.name}` : counter.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Leaderboard counterId={selected.id} unit={selected.unit} streak={selected.streak_enabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  chips: { gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 14, fontFamily: fonts.title },
  empty: { fontSize: 14, fontFamily: fonts.detail },
});

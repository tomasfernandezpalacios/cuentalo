import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

export type ChipCounter = { id: string; name: string; emoji: string | null; color: string };

type Props = {
  counters: ChipCounter[];
  visibleIds: string[];
  onToggle: (id: string) => void;
  onOpenFilters: () => void;
  /** Hay un filtro aplicado (se marca el icono). */
  filtered: boolean;
};

/** Barra de Estadísticas: icono de filtros y un botón por contador para mostrarlo u ocultarlo. */
export function CounterChipsBar({
  counters,
  visibleIds,
  onToggle,
  onOpenFilters,
  filtered,
}: Props) {
  const colors = useThemeColors();
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onOpenFilters}
        accessibilityRole="button"
        accessibilityLabel={filtered ? 'Filtros aplicados. Cambiar filtros' : 'Filtrar contadores'}
        hitSlop={6}
        style={[
          styles.filter,
          {
            backgroundColor: filtered ? colors.primary : colors.surface,
            borderColor: filtered ? colors.primary : colors.border,
          },
        ]}
      >
        <Ionicons
          name="options-outline"
          size={18}
          color={filtered ? colors.onPrimary : colors.primary}
        />
      </Pressable>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {counters.map((counter) => {
          const visible = visibleIds.includes(counter.id);
          return (
            <Pressable
              key={counter.id}
              onPress={() => onToggle(counter.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: visible }}
              accessibilityLabel={`${counter.name}, ${visible ? 'visible' : 'oculto'} en la gráfica`}
              style={[
                styles.chip,
                {
                  backgroundColor: visible ? `${counter.color}22` : colors.surface,
                  borderColor: visible ? counter.color : colors.border,
                },
              ]}
            >
              <View
                style={[styles.dot, { backgroundColor: visible ? counter.color : colors.border }]}
              />
              <Text
                style={[styles.label, { color: visible ? colors.text : colors.textMuted }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
              >
                {counter.emoji ? `${counter.emoji} ${counter.name}` : counter.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1.5,
    maxWidth: 200,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 14, fontFamily: fonts.title },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorView, LoadingView } from '@/components/StateViews';
import { updateSettings, useSettings } from '@/features/configuracion/settings';
import { CounterAvatar } from '@/features/contadores/components/CounterAvatar';
import { useCounterList } from '@/features/contadores/hooks';
import { fonts, useThemeColors } from '@/lib/theme';

const LAST_USED = 'last';

/** Elige qué contador se dibuja al abrir Estadísticas: el último usado o uno fijo. */
export default function StatsDefaultScreen() {
  const colors = useThemeColors();
  const { statsDefault } = useSettings();
  const counters = useCounterList();

  if (counters.isPending) return <LoadingView />;
  if (counters.isError) return <ErrorView error={counters.error} onRetry={counters.refetch} />;

  const options = [
    { id: LAST_USED, name: 'El último que usé', emoji: null as string | null },
    ...counters.data
      .filter((c) => !c.linkedInto && !c.archived && (c.isActive || c.myEntryCount > 0))
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
      .map((c) => ({ id: c.id, name: c.name, emoji: c.emoji })),
  ];

  function choose(id: string) {
    updateSettings({ statsDefault: id });
    router.back();
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.list}
      data={options}
      keyExtractor={(o) => o.id}
      ListHeaderComponent={
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Al abrir Estadísticas, la gráfica empieza mostrando este contador.
        </Text>
      }
      renderItem={({ item }) => {
        const selected = item.id === statsDefault;
        return (
          <Pressable
            onPress={() => choose(item.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={item.name}
            style={[styles.row, { borderBottomColor: colors.border }]}
          >
            {item.id === LAST_USED ? (
              <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
              </View>
            ) : (
              <CounterAvatar emoji={item.emoji} name={item.name} size={36} />
            )}
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={selected ? colors.primary : colors.textMuted}
            />
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  hint: { fontSize: 14, fontFamily: fonts.detail, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 16, fontFamily: fonts.title },
});

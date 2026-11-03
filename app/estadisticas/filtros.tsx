import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { CounterAvatar } from '@/features/contadores/components/CounterAvatar';
import { useFolders } from '@/features/contadores/folders';
import { useCounterList } from '@/features/contadores/hooks';
import { applyStatsFilter, useStatsSelection } from '@/features/estadisticas/selection';
import { fonts, useThemeColors } from '@/lib/theme';

/** Quita tildes y mayúsculas para buscar «cafe» y encontrar «Café». */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Pantalla completa para elegir qué contadores ver en Estadísticas. */
export default function StatsFiltersScreen() {
  const colors = useThemeColors();
  const counters = useCounterList();
  const folders = useFolders();
  const current = useStatsSelection();
  const [selected, setSelected] = useState<string[]>(current.pool ?? current.visible ?? []);
  const [query, setQuery] = useState('');

  // Todos los contadores con los que tengo algo que ver, en orden alfabético.
  const all = (counters.data ?? [])
    .filter((c) => c.isActive || c.myEntryCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  const visible = query.trim()
    ? all.filter((c) => normalize(c.name).includes(normalize(query.trim())))
    : all;

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  // Pulsar una carpeta añade todos sus contadores; si ya estaban todos, los quita.
  function toggleFolder(counterIds: string[]) {
    const ids = counterIds.filter((id) => all.some((c) => c.id === id));
    const allIn = ids.length > 0 && ids.every((id) => selected.includes(id));
    setSelected((s) =>
      allIn ? s.filter((id) => !ids.includes(id)) : [...new Set([...s, ...ids])],
    );
  }

  function apply() {
    applyStatsFilter(selected);
    router.back();
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Filtrar estadísticas',
          headerTitleAlign: 'center',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={10}>
              <Text style={[styles.headerButton, { color: colors.textMuted }]}>Cancelar</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={apply} accessibilityRole="button" hitSlop={10}>
              <Text style={[styles.headerButton, { color: colors.primary }]}>Aplicar</Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={visible}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View
              style={[
                styles.search,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar contador"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Buscar contador"
                autoCorrect={false}
                style={[styles.searchInput, { color: colors.text }]}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} accessibilityLabel="Borrar búsqueda">
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {(folders.data ?? []).length > 0 ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>Carpetas enteras</Text>
                <View style={styles.chips}>
                  {(folders.data ?? []).map((folder) => {
                    const inAll =
                      folder.counterIds.length > 0 &&
                      folder.counterIds.every((id) => selected.includes(id));
                    return (
                      <Pressable
                        key={folder.id}
                        onPress={() => toggleFolder(folder.counterIds)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: inAll }}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: inAll ? colors.primary : colors.surface,
                            borderColor: inAll ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: inAll ? colors.onPrimary : colors.text },
                          ]}
                        >
                          📁 {folder.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <View style={styles.row2}>
              <Text style={[styles.label, { color: colors.textMuted }]}>
                Contadores ({selected.length})
              </Text>
              <View style={styles.quick}>
                <AppButton
                  small
                  variant="ghost"
                  title="Todos"
                  onPress={() => setSelected(all.map((c) => c.id))}
                />
                <AppButton small variant="ghost" title="Ninguno" onPress={() => setSelected([])} />
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.label, styles.empty, { color: colors.textMuted }]}>
            {counters.isPending ? 'Cargando…' : 'Ningún contador coincide con la búsqueda.'}
          </Text>
        }
        renderItem={({ item }) => {
          const checked = selected.includes(item.id);
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={item.name}
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={24}
                color={checked ? colors.primary : colors.textMuted}
              />
              <CounterAvatar emoji={item.emoji} name={item.name} size={36} />
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16 },
  header: { gap: 12, marginBottom: 4 },
  headerButton: { fontSize: 16, fontFamily: fonts.title, paddingHorizontal: 8 },
  label: { fontSize: 14, fontFamily: fonts.detail },
  empty: { textAlign: 'center', paddingVertical: 24 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 14, fontFamily: fonts.title },
  row2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quick: { flexDirection: 'row' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flex: 1, fontSize: 16, fontFamily: fonts.title },
});

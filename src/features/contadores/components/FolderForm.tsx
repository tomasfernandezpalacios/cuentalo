import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { TextField } from '@/components/TextField';
import { appAlert } from '@/components/AppDialog';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';
import { LIMITS, validateRequiredText } from '@/lib/validation';

import type { CounterWithTotal } from '../api';
import { useSaveFolder, type Folder } from '../folders';
import { useCounterList } from '../hooks';

import { CounterAvatar } from './CounterAvatar';

/** Quita tildes y mayúsculas para buscar «cafe» y encontrar «Café». */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

type Props = {
  /** Carpeta a editar; si no se pasa, se crea una nueva. */
  folder?: Folder;
  /** Al crear: contadores ya marcados (desde la selección de la pantalla principal). */
  initialCounterIds?: string[];
};

/** Pantalla completa: nombre, buscador y lista de contadores con casillas. */
export function FolderForm({ folder, initialCounterIds = [] }: Props) {
  const colors = useThemeColors();
  const counters = useCounterList();
  const save = useSaveFolder(folder?.id ?? null);
  const [name, setName] = useState(folder?.name ?? '');
  const [selected, setSelected] = useState<string[]>(folder?.counterIds ?? initialCounterIds);
  const [query, setQuery] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const all: CounterWithTotal[] = (counters.data ?? [])
    .filter((c) => c.isActive && !c.linkedInto)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  const visible = query.trim()
    ? all.filter((c) => normalize(c.name).includes(normalize(query.trim())))
    : all;

  // Grupos con contadores en la lista, para elegir todos los de un grupo de una vez.
  const groups = [
    ...new Map(
      all.flatMap((c) => c.linkedGroups.map((g) => [g.group.id, g.group] as const)),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

  /** Marca los contadores del grupo; si ya estaban todos marcados, los desmarca. */
  function toggleGroup(groupId: string) {
    const ids = all
      .filter((c) => c.linkedGroups.some((g) => g.group.id === groupId))
      .map((c) => c.id);
    const allIn = ids.every((id) => selected.includes(id));
    setSelected((current) =>
      allIn ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])],
    );
  }

  const quickButtons = [
    { key: 'all', label: 'Todos', onPress: () => setSelected(all.map((c) => c.id)) },
    { key: 'none', label: 'Ninguno', onPress: () => setSelected([]) },
    ...groups.map((g) => ({ key: g.id, label: `👥 ${g.name}`, onPress: () => toggleGroup(g.id) })),
  ];

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current, id],
    );
  }

  function handleDone() {
    const error = validateRequiredText(name, 'El nombre', LIMITS.folderName);
    setNameError(error);
    if (error) return;
    // La carpeta ya se ve en la barra (optimista): se cierra al instante y se guarda por detrás.
    save.mutate(
      { name, counterIds: selected },
      { onError: (error) => appAlert('No se ha podido guardar', getErrorMessage(error)) },
    );
    router.back();
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: folder ? 'Editar carpeta' : 'Nueva carpeta',
          headerRight: () =>
            save.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Pressable onPress={handleDone} accessibilityRole="button" hitSlop={10}>
                <Text style={[styles.headerButton, { color: colors.primary }]}>Hecho</Text>
              </Pressable>
            ),
        }}
      />
      <FlatList
        data={visible}
        keyExtractor={(counter) => counter.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <TextField
              label="Nombre de la carpeta"
              value={name}
              onChangeText={setName}
              error={nameError}
              placeholder="ej. Deporte, Ocio, Viajes"
              maxLength={LIMITS.folderName}
              autoFocus={!folder}
            />
            {save.error ? (
              <Text style={[styles.detail, { color: colors.danger }]}>
                {getErrorMessage(save.error)}
              </Text>
            ) : null}
            <Text style={[styles.detail, { color: colors.text }]}>
              Contadores incluidos ({selected.length})
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.quick}
            >
              {quickButtons.map((button) => (
                <Pressable
                  key={button.key}
                  onPress={button.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={
                    button.key === 'all'
                      ? 'Elegir todos'
                      : button.key === 'none'
                        ? 'Quitar todos'
                        : `Elegir los de ${button.label}`
                  }
                  style={({ pressed }) => [
                    styles.quickChip,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.quickText, { color: colors.text }]} numberOfLines={1}>
                    {button.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
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
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.detail, styles.empty, { color: colors.textMuted }]}>
            {counters.isPending
              ? 'Cargando…'
              : query
                ? 'Ningún contador coincide con la búsqueda.'
                : 'Todavía no tienes contadores.'}
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
              <CounterAvatar
                emoji={item.emoji}
                name={item.name}
                photoPath={item.photo_path}
                size={36}
              />
              <View style={styles.flex}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.group ? (
                  <Text style={[styles.detail, { color: colors.textMuted }]} numberOfLines={1}>
                    👥 {item.group.name}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  quick: { gap: 8 },
  quickChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  quickText: { fontSize: 14, fontFamily: fonts.title },
  flex: { flex: 1 },
  list: { padding: 16 },
  header: { gap: 14, marginBottom: 8 },
  headerButton: { fontSize: 16, fontFamily: fonts.title, paddingHorizontal: 8 },
  detail: { fontSize: 14, fontFamily: fonts.detail },
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
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 8, fontFamily: fonts.detail },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { fontSize: 16, fontFamily: fonts.title },
});

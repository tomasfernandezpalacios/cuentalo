import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import type { CounterWithTotal, EntryInput } from '@/features/contadores/api';
import { CounterCard } from '@/features/contadores/components/CounterCard';
import { EntryDialog } from '@/features/contadores/components/EntryDialog';
import { FilterMenu } from '@/features/contadores/components/FilterMenu';
import { FolderBar } from '@/features/contadores/components/FolderBar';
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  filterCounters,
  type CounterFilters,
} from '@/features/contadores/filters';
import { useDeleteFolder, useFolders, type Folder } from '@/features/contadores/folders';
import { useAddEntry, useCounterList, useRemoveOne } from '@/features/contadores/hooks';
import { getErrorMessage } from '@/lib/errors';
import { useThemeColors } from '@/lib/theme';

function openNewCounter() {
  router.push('/contadores/nuevo');
}

function showError(error: unknown) {
  Alert.alert('No se ha podido guardar', getErrorMessage(error));
}

export default function CountersScreen() {
  const colors = useThemeColors();
  const { data, error, isPending, isRefetching, refetch } = useCounterList();
  const folders = useFolders();
  const deleteFolder = useDeleteFolder();
  const addEntry = useAddEntry();
  const removeOne = useRemoveOne();
  const [showArchived, setShowArchived] = useState(false);
  // Al abrir la app siempre se empieza en «Todos» y sin filtros.
  const [filters, setFilters] = useState<CounterFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Contador para el que se está escribiendo una cantidad personalizada.
  const [customFor, setCustomFor] = useState<CounterWithTotal | null>(null);

  if (isPending) return <LoadingView />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const folderList = folders.data ?? [];
  const filterCount = activeFilterCount(filters);

  // Solo los míos y los de grupos donde sigo; los de grupos que dejé quedan para estadísticas.
  const active = data.filter((c) => c.isActive && !c.linkedInto);
  const filtered = filterCounters(active, filters, folderList);
  const archivedCount = filtered.filter((c) => c.archived).length;
  const counters = showArchived ? filtered : filtered.filter((c) => !c.archived);

  function add(counterId: string, input: EntryInput, onSuccess?: () => void) {
    addEntry.mutate({ counterId, input }, { onSuccess, onError: showError });
  }

  function folderOptions(folder: Folder) {
    Alert.alert(folder.name, undefined, [
      {
        text: 'Editar carpeta',
        onPress: () => router.push({ pathname: '/carpetas/[id]', params: { id: folder.id } }),
      },
      {
        text: 'Eliminar carpeta',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Eliminar carpeta',
            `Se borrará la carpeta «${folder.name}». Los contadores no se borran.`,
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Eliminar',
                style: 'destructive',
                onPress: () =>
                  deleteFolder.mutate(folder.id, {
                    onSuccess: () => {
                      if (filters.folderId === folder.id) {
                        setFilters({ ...filters, folderId: null });
                      }
                    },
                    onError: showError,
                  }),
              },
            ],
          ),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  const selectedFolder = folderList.find((f) => f.id === filters.folderId);
  const emptyView =
    active.length === 0 ? (
      <EmptyView
        title="Aún no tienes contadores"
        description="Crea uno para empezar a contar: cervezas, libros, kilómetros…"
        actionTitle="Crear contador"
        onAction={openNewCounter}
      />
    ) : selectedFolder && selectedFolder.counterIds.length === 0 ? (
      <EmptyView
        title="Esta carpeta está vacía"
        description="Añade contadores a la carpeta para verlos aquí."
        actionTitle="Editar carpeta"
        onAction={() =>
          router.push({ pathname: '/carpetas/[id]', params: { id: selectedFolder.id } })
        }
      />
    ) : (
      <EmptyView
        title="Ningún contador cumple los filtros"
        actionTitle="Quitar filtros"
        onAction={() => setFilters(DEFAULT_FILTERS)}
      />
    );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => router.push('/contadores/fusionar')}
                accessibilityRole="button"
                accessibilityLabel="Fusionar contadores"
                hitSlop={10}
              >
                <Ionicons name="git-merge-outline" size={25} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => setFiltersOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={
                  filterCount > 0 ? `Filtros, ${filterCount} activos` : 'Filtrar contadores'
                }
                hitSlop={10}
              >
                <Ionicons name="options-outline" size={26} color={colors.primary} />
                {filterCount > 0 ? (
                  <View style={[styles.badge, { backgroundColor: colors.danger }]} />
                ) : null}
              </Pressable>
              <Pressable
                onPress={openNewCounter}
                accessibilityRole="button"
                accessibilityLabel="Nuevo contador"
                hitSlop={6}
                style={({ pressed }) => [
                  styles.addButton,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons name="add" size={26} color="#000000" />
              </Pressable>
            </View>
          ),
        }}
      />
      <FolderBar
        folders={folderList}
        selectedId={filters.folderId}
        onSelect={(folderId) => setFilters({ ...filters, folderId })}
        onLongPressFolder={folderOptions}
        onNewFolder={() => router.push('/carpetas/nueva')}
      />
      <FlatList
        data={counters}
        keyExtractor={(counter) => counter.id}
        renderItem={({ item }) => (
          <CounterCard
            counter={item}
            onPress={() => router.push({ pathname: '/contadores/[id]', params: { id: item.id } })}
            onAdd={(amount) => add(item.id, { amount, loggedAt: new Date(), note: null })}
            onRemoveOne={() => removeOne.mutate(item.id, { onError: showError })}
            onCustomAdd={() => setCustomFor(item)}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            colors={[colors.primary]}
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
              folders.refetch();
            }}
          />
        }
        ListEmptyComponent={emptyView}
        ListFooterComponent={
          archivedCount > 0 ? (
            <AppButton
              variant="ghost"
              title={showArchived ? 'Ocultar archivados' : `Ver archivados (${archivedCount})`}
              onPress={() => setShowArchived((value) => !value)}
            />
          ) : undefined
        }
      />
      <FilterMenu
        visible={filtersOpen}
        filters={filters}
        folders={folderList}
        onChange={setFilters}
        onClose={() => setFiltersOpen(false)}
      />
      <EntryDialog
        visible={customFor !== null}
        unit={customFor?.unit ?? null}
        saving={addEntry.isPending}
        onSave={(input) => customFor && add(customFor.id, input, () => setCustomFor(null))}
        onClose={() => setCustomFor(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 12, gap: 10, flexGrow: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginRight: 14 },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { position: 'absolute', top: -1, right: -2, width: 9, height: 9, borderRadius: 5 },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ComponentProps } from 'react';
import {
  BackHandler,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import type { CounterWithTotal } from '@/features/contadores/api';
import { CounterCard } from '@/features/contadores/components/CounterCard';
import { EntryDialog } from '@/features/contadores/components/EntryDialog';
import { FilterMenu } from '@/features/contadores/components/FilterMenu';
import { FolderBar } from '@/features/contadores/components/FolderBar';
import { FolderPicker } from '@/features/contadores/components/FolderPicker';
import { confirmDeleteOrRemove } from '@/features/contadores/confirmDelete';
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  filterCounters,
  type CounterFilters,
} from '@/features/contadores/filters';
import {
  useDeleteFolder,
  useFolders,
  useAddToFolder,
  type Folder,
} from '@/features/contadores/folders';
import {
  useCounterList,
  useDeleteCounters,
  useSetHidden,
  useSetRemovedFromHome,
} from '@/features/contadores/hooks';
import { useCounterActions } from '@/features/contadores/useCounterActions';
import { StreakBadge } from '@/features/estadisticas/components/StreakBadge';
import { TutorialTarget } from '@/features/tutorial/TutorialTarget';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';

function openNewCounter() {
  router.push('/contadores/nuevo');
}

function showError(error: unknown) {
  appAlert('Error', getErrorMessage(error));
}

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function CountersScreen() {
  const colors = useThemeColors();
  const { data, error, isPending, isRefetching, refetch } = useCounterList();
  const folders = useFolders();
  const deleteFolder = useDeleteFolder();
  const deleteCounters = useDeleteCounters();
  const setHidden = useSetHidden();
  const removeFromHome = useSetRemovedFromHome();
  const actions = useCounterActions();
  const [showArchived, setShowArchived] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  // Al abrir la app siempre se empieza en «Todos» y sin filtros.
  const [filters, setFilters] = useState<CounterFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Contador para el que se está escribiendo una cantidad personalizada.
  const [customFor, setCustomFor] = useState<CounterWithTotal | null>(null);
  // Modo selección: se entra manteniendo pulsado un contador.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const addToFolderMutation = useAddToFolder();

  const selecting = selectedIds.length > 0;

  // El botón «atrás» de Android sale del modo selección en vez de salir de la pantalla.
  useFocusEffect(
    useCallback(() => {
      if (!selecting) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setSelectedIds([]);
        return true;
      });
      return () => sub.remove();
    }, [selecting]),
  );

  if (isPending) return <LoadingView />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const folderList = folders.data ?? [];
  const filterCount = activeFilterCount(filters);

  // Solo los míos y los de grupos donde sigo; los de grupos que dejé quedan para estadísticas.
  // Los quitados de la pantalla principal tampoco (siguen dentro de su grupo).
  const active = data.filter((c) => c.isActive && !c.linkedInto && !c.removedFromHome);
  const filtered = filterCounters(active, filters, folderList);
  // Grupos con algún contador en mi lista, por orden alfabético (filtro «De grupo» → grupo).
  const listGroups = [
    ...new Map(
      active.flatMap((c) => c.linkedGroups.map((g) => [g.group.id, g.group] as const)),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  const archivedCount = filtered.filter((c) => c.archived && !c.hidden).length;
  const shown = filtered.filter((c) => !c.hidden && (showArchived || !c.archived));
  // Los ocultos salen al final de la lista.
  const hidden = filtered.filter((c) => c.hidden);
  const selected = active.filter((c) => selectedIds.includes(c.id));

  function toggleSelected(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  // --- Acciones del modo selección ---------------------------------------------------------

  function deleteSelected() {
    // Los que administro se borran; los de grupo que no administro solo se quitan de mi
    // pantalla principal (sigo perteneciendo a ellos).
    const toDelete = selected.filter((c) => c.canManage);
    const toRemove = selected.filter((c) => !c.canManage);
    confirmDeleteOrRemove(toDelete, toRemove, async () => {
      try {
        if (toRemove.length > 0) {
          await removeFromHome.mutateAsync({ ids: toRemove.map((c) => c.id), removed: true });
        }
        if (toDelete.length > 0) await deleteCounters.mutateAsync(toDelete);
        clearSelection();
      } catch (error) {
        showError(error);
      }
    });
  }

  function toggleHiddenSelected() {
    const allHidden = selected.every((c) => c.hidden);
    setHidden.mutate(
      { ids: selectedIds, hidden: !allHidden },
      { onSuccess: clearSelection, onError: showError },
    );
  }

  function editSelected() {
    const [counter] = selected;
    if (selected.length !== 1 || !counter) {
      appAlert('Editar', 'Solo se puede editar un contador cada vez.');
      return;
    }
    if (!counter.canManage) {
      appAlert('Editar', `Solo el administrador puede editar «${counter.name}».`);
      return;
    }
    clearSelection();
    router.push({ pathname: '/contadores/[id]/editar', params: { id: counter.id } });
  }

  function mergeSelected() {
    const ids = selectedIds.join(',');
    clearSelection();
    router.push({ pathname: '/contadores/fusionar', params: { contadores: ids } });
  }

  function addToFolder(folder: Folder) {
    setFolderPickerOpen(false);
    addToFolderMutation.mutate(
      { folder, counterIds: selectedIds },
      { onSuccess: clearSelection, onError: showError },
    );
  }

  function addToNewFolder() {
    const ids = selectedIds.join(',');
    setFolderPickerOpen(false);
    clearSelection();
    router.push({ pathname: '/carpetas/nueva', params: { contadores: ids } });
  }

  // --- Carpetas ---------------------------------------------------------------------------

  function folderOptions(folder: Folder) {
    appAlert(folder.name, undefined, [
      {
        text: 'Editar carpeta',
        onPress: () => router.push({ pathname: '/carpetas/[id]', params: { id: folder.id } }),
      },
      {
        text: 'Eliminar carpeta',
        style: 'destructive',
        onPress: () =>
          appAlert(
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

  // --- Vista ------------------------------------------------------------------------------

  function renderCard(item: CounterWithTotal, isFirst = false) {
    return (
      <CounterCard
        key={item.id}
        counter={item}
        tutorialTarget={isFirst}
        selectionMode={selecting}
        selected={selectedIds.includes(item.id)}
        onLongPress={() => toggleSelected(item.id)}
        onPress={() =>
          selecting
            ? toggleSelected(item.id)
            : router.push({ pathname: '/contadores/[id]', params: { id: item.id } })
        }
        onAdd={(amount) => actions.add(item, { amount, loggedAt: new Date(), note: null })}
        onRemoveOne={() => actions.subtractOne(item)}
        onCustomAdd={() => setCustomFor(item)}
      />
    );
  }

  function headerIcon(name: IconName, label: string, onPress: () => void, disabled = false) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        hitSlop={8}
        style={{ opacity: disabled ? 0.35 : 1 }}
      >
        <Ionicons name={name} size={24} color={colors.primary} />
      </Pressable>
    );
  }

  const selectionOptions = {
    headerLeft: () => (
      <Pressable
        onPress={clearSelection}
        accessibilityRole="button"
        accessibilityLabel="Salir de la selección"
        hitSlop={10}
        style={styles.close}
      >
        <Ionicons name="close" size={26} color={colors.text} />
      </Pressable>
    ),
    headerTitle: () => (
      <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
        {selectedIds.length === 1 ? '1 seleccionado' : `${selectedIds.length} seleccionados`}
      </Text>
    ),
    headerRight: () => (
      <View style={styles.selectionActions}>
        {headerIcon('trash-outline', 'Borrar', deleteSelected)}
        <Pressable
          onPress={() => setFolderPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Añadir a una carpeta"
          hitSlop={8}
        >
          <Ionicons name="folder-outline" size={24} color={colors.primary} />
          <View style={[styles.folderPlus, { backgroundColor: colors.surface }]}>
            <Ionicons name="add" size={13} color={colors.primary} />
          </View>
        </Pressable>
        {headerIcon(
          selected.every((c) => c.hidden) ? 'eye-outline' : 'eye-off-outline',
          selected.every((c) => c.hidden) ? 'Mostrar' : 'Ocultar',
          toggleHiddenSelected,
        )}
        {headerIcon('create-outline', 'Editar', editSelected, selectedIds.length !== 1)}
        {headerIcon('git-merge-outline', 'Fusionar', mergeSelected)}
      </View>
    ),
  };

  const normalOptions = {
    headerLeft: undefined,
    // Título con el fuego de la racha a su derecha.
    headerTitle: () => (
      <View style={styles.title}>
        <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
          Mis contadores
        </Text>
        <TutorialTarget id="racha">
          <StreakBadge />
        </TutorialTarget>
      </View>
    ),
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
        <TutorialTarget id="nuevo-contador">
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
        </TutorialTarget>
      </View>
    ),
  };

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
    ) : hidden.length > 0 ? undefined : (
      <EmptyView
        title="Ningún contador cumple los filtros"
        actionTitle="Quitar filtros"
        onAction={() => setFilters(DEFAULT_FILTERS)}
      />
    );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={selecting ? selectionOptions : normalOptions} />
      <FolderBar
        folders={folderList}
        selectedId={filters.folderId}
        onSelect={(folderId) => setFilters({ ...filters, folderId })}
        onLongPressFolder={folderOptions}
        onNewFolder={() => router.push('/carpetas/nueva')}
      />
      <FlatList
        data={shown}
        keyExtractor={(counter) => counter.id}
        renderItem={({ item, index }) => renderCard(item, index === 0)}
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
          <View style={styles.footer}>
            {archivedCount > 0 ? (
              <AppButton
                variant="ghost"
                title={showArchived ? 'Ocultar archivados' : `Ver archivados (${archivedCount})`}
                onPress={() => setShowArchived((value) => !value)}
              />
            ) : null}
            {hidden.length > 0 ? (
              <View style={styles.hidden}>
                {/* Desplegable cerrado por defecto: los ocultos no estorban en la lista. */}
                <Pressable
                  onPress={() => setShowHidden((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showHidden }}
                  accessibilityLabel={`Ocultos, ${hidden.length}`}
                  style={({ pressed }) => [
                    styles.hiddenToggle,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="eye-off-outline" size={20} color={colors.textMuted} />
                  <Text style={[styles.hiddenTitle, { color: colors.text }]}>
                    Ocultos ({hidden.length})
                  </Text>
                  <Ionicons
                    name={showHidden ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
                {showHidden ? hidden.map((item) => renderCard(item)) : null}
              </View>
            ) : null}
          </View>
        }
      />
      <FilterMenu
        visible={filtersOpen}
        filters={filters}
        folders={folderList}
        groups={listGroups}
        onChange={setFilters}
        onClose={() => setFiltersOpen(false)}
      />
      <FolderPicker
        visible={folderPickerOpen}
        folders={folderList}
        counterIds={selectedIds}
        onPick={addToFolder}
        onNewFolder={addToNewFolder}
        onClose={() => setFolderPickerOpen(false)}
      />
      <EntryDialog
        visible={customFor !== null}
        unit={customFor?.unit ?? null}
        saving={actions.saving}
        onSave={(input) => customFor && actions.add(customFor, input, () => setCustomFor(null))}
        onClose={() => setCustomFor(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleText: { fontSize: 18, fontFamily: fonts.title },
  list: { padding: 12, gap: 10, flexGrow: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginRight: 14 },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginRight: 14 },
  close: { marginHorizontal: 12 },
  folderPlus: {
    position: 'absolute',
    right: -5,
    bottom: -3,
    borderRadius: 7,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { position: 'absolute', top: -1, right: -2, width: 9, height: 9, borderRadius: 5 },
  footer: { gap: 10 },
  hidden: { gap: 10, marginTop: 16 },
  hiddenTitle: { flex: 1, fontSize: 15, fontFamily: fonts.title },
  hiddenToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
});

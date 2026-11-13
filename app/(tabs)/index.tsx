import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ComponentProps, type ComponentRef } from 'react';
import {
  Animated,
  BackHandler,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useIsOnline } from '@/lib/offline';
import { usePullRefresh } from '@/lib/usePullRefresh';
import { appAlert } from '@/components/AppDialog';
import { updateSettings, useSettings } from '@/features/configuracion/settings';
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
import { useCounterOrder, useSetCounterOrder } from '@/features/perfil/birthDate';
import { TutorialTarget } from '@/features/tutorial/TutorialTarget';
import { getErrorMessage } from '@/lib/errors';
import { applyOrder } from '@/lib/reorder';
import { matchesSearch } from '@/lib/search';
import { useDragReorder } from '@/lib/useDragReorder';
import { reportBadgeWidth, TITLE_GAP, useScreenTitleSize } from '@/lib/screenTitle';
import { fonts, isCinema, screenTitleFont, useThemeColors } from '@/lib/theme';

function openNewCounter() {
  router.push('/contadores/nuevo');
}

function showError(error: unknown) {
  appAlert('Error', getErrorMessage(error));
}

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function CountersScreen() {
  const colors = useThemeColors();
  const { data, error, isPending, refetch } = useCounterList();
  const folders = useFolders();
  // El círculo de recarga solo sale al tirar (no con cada refresco por detrás).
  const online = useIsOnline();
  const pull = usePullRefresh(() => Promise.all([refetch(), folders.refetch()]));
  const deleteFolder = useDeleteFolder();
  const deleteCounters = useDeleteCounters();
  const setHidden = useSetHidden();
  const removeFromHome = useSetRemovedFromHome();
  const actions = useCounterActions();
  const [showHidden, setShowHidden] = useState(false);
  // Vista de los contadores (filas o bloques), guardada en el móvil.
  const { counterLayout } = useSettings();
  const titleSize = useScreenTitleSize();
  const grid = counterLayout === 'grid';
  const { width } = useWindowDimensions();
  const gridItemWidth = (width - 2 * LIST_PADDING - CARD_GAP) / 2;
  // «Ocultos» solo aparece al llegar al final de la lista y se recoge al volver a subir.
  const [revealHidden, setRevealHidden] = useState(false);
  const [revealAnim] = useState(() => new Animated.Value(0));
  // Barras de arriba (carpetas, vista y búsqueda): escondidas hasta tirar hacia abajo arriba del
  // todo. Siempre visibles en el modo selección, con una carpeta elegida o con algo buscado.
  // Barras de arriba (carpetas, vista y búsqueda) dentro de la propia lista, encima de los
  // contadores: al abrir, la lista empieza justo debajo de ellas (escondidas) y salen solas al
  // subir más allá del primer contador, al ritmo del dedo, como el resto de la lista.
  const [barsHeight, setBarsHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const listRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const barsHiddenOnce = useRef(false);
  const scrollMetrics = useRef({ offset: 0, viewport: 0, content: 0, titleTop: 0 });
  // Al abrir la app siempre se empieza en «Todos» y sin filtros.
  const [filters, setFilters] = useState<CounterFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Buscador por nombre (sale cuando hay bastantes contadores).
  const [query, setQuery] = useState('');
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

  // La lista (va antes de las pantallas de carga: el arrastre la necesita siempre).
  const folderList = folders.data ?? [];
  // Solo los míos y los de grupos donde sigo; los de grupos que dejé quedan para estadísticas.
  // Los quitados de la pantalla principal tampoco (siguen dentro de su grupo).
  const active = (data ?? []).filter((c) => c.isActive && !c.linkedInto && !c.removedFromHome);
  // Orden del usuario (manteniendo pulsado y arrastrando); los nuevos van al final.
  const counterOrder = useCounterOrder();
  const setCounterOrder = useSetCounterOrder();
  const ordered = applyOrder(active, counterOrder, (c) => c.id);
  const filtered = filterCounters(ordered, filters, folderList).filter((c) =>
    matchesSearch(c.name, query),
  );
  const shown = filtered.filter((c) => !c.hidden);

  // Mantener pulsado una tarjeta la levanta: si se arrastra, cambia de sitio; si se suelta sin
  // moverla, entra en el modo selección. La selección no cambia mientras se arrastra (antes sí y
  // la lista cambiaba de forma a mitad del gesto, por eso las tarjetas «se rallaban»).
  const drag = useDragReorder({
    keys: shown.map((c) => c.id),
    gap: CARD_GAP,
    // En bloques también se reordena arrastrando, en las dos direcciones.
    columns: grid ? 2 : 1,
    onHold: (id) => toggleSelected(id),
    onReorder: (keys) =>
      setCounterOrder.mutate([
        ...keys,
        ...ordered.map((c) => c.id).filter((id) => !keys.includes(id)),
      ]),
  });

  if (isPending) return <LoadingView />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const filterCount = activeFilterCount(filters);
  const showSearch = active.length >= SEARCH_FROM || query !== '';
  // Grupos con algún contador en mi lista, por orden alfabético (filtro «De grupo» → grupo).
  const listGroups = [
    ...new Map(
      active.flatMap((c) => c.linkedGroups.map((g) => [g.group.id, g.group] as const)),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  // Tarjeta que ilumina el tutorial: la primera en la que se puede sumar directamente (en un
  // común de otro, el +1 abre una solicitud y el paso «Suma con un toque» no avanzaría).
  const tutorialCardId = shown.find((c) => !(c.is_common && !c.canManage))?.id;
  // Los ocultos salen al final de la lista.
  const hidden = filtered.filter((c) => c.hidden);
  const selected = active.filter((c) => selectedIds.includes(c.id));

  function toggleSelected(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  /**
   * «Todos» o una carpeta en el modo selección: si ya estaban todos sus contadores
   * seleccionados, se quitan; si no, se añaden los que falten.
   */
  function toggleMany(ids: string[]) {
    setSelectedIds((current) =>
      ids.every((id) => current.includes(id))
        ? current.filter((id) => !ids.includes(id))
        : [...current, ...ids.filter((id) => !current.includes(id))],
    );
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

  // --- Ocultos al final ------------------------------------------------------------------

  /**
   * El título «Ocultos» se ve cuando el final de la pantalla llega a él (has bajado del todo).
   * Si se vuelve a subir por encima, se recoge el desplegable y el título se esconde.
   */
  function checkReveal() {
    const metrics = scrollMetrics.current;
    const { offset, viewport, content } = metrics;
    if (!viewport || !content || !metrics.titleTop) return;
    // Dónde empieza «Ocultos»: solo se calcula con el desplegable cerrado. Al abrirlo, el título
    // no se mueve (lo nuevo sale debajo); antes se recalculaba con medidas a medio actualizar
    // (la lista ya más larga y el pie aún corto) y el desplegable se cerraba solo al tocarlo.
    const reveal = offset + viewport >= metrics.titleTop + REVEAL_MARGIN;
    if (reveal === revealHidden) return;
    setRevealHidden(reveal);
    if (!reveal) setShowHidden(false);
    Animated.timing(revealAnim, {
      toValue: reveal ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }

  function onListScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollMetrics.current.offset = e.nativeEvent.contentOffset.y;
    checkReveal();
  }

  /** Al abrir: la lista empieza justo debajo de las barras (escondidas). Una vez. */
  function hideBarsInitially() {
    const { viewport, content } = scrollMetrics.current;
    if (barsHiddenOnce.current || !barsHeight || !viewport) return;
    if (content < viewport + barsHeight - 1) return;
    barsHiddenOnce.current = true;
    listRef.current?.scrollTo({ y: barsHeight, animated: false });
  }

  /**
   * Al soltar a medio camino, las barras terminan de salir o de esconderse (nunca a medias).
   * Con un movimiento rápido se deja que la lista siga su inercia y se ajusta al pararse.
   */
  function settleBars(y: number) {
    if (!barsHeight || y <= 0 || y >= barsHeight) return;
    listRef.current?.scrollTo({ y: y < barsHeight / 2 ? 0 : barsHeight, animated: true });
  }

  // --- Vista ------------------------------------------------------------------------------

  function renderCard(item: CounterWithTotal, isFirst = false, draggable = false) {
    const dragProps = draggable ? drag.itemProps(item.id) : null;
    const card = (
      <CounterCard
        key={item.id}
        counter={item}
        tutorialTarget={isFirst}
        grid={grid}
        selectionMode={selecting}
        selected={selectedIds.includes(item.id)}
        onLongPress={(e) => (dragProps ? dragProps.onLongPress(e) : toggleSelected(item.id))}
        onPressOut={dragProps?.onPressOut}
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
    if (!dragProps) return card;
    return (
      <Animated.View
        key={item.id}
        onLayout={dragProps.onLayout}
        style={[grid && { width: gridItemWidth }, dragProps.style]}
      >
        {card}
      </Animated.View>
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
      // No es un título: va con la letra normal y a tamaño de texto, sin pisar los botones.
      // Más pequeño y con ancho máximo (dejando sitio a la X y a los botones): antes se
      // superponía con las herramientas de la derecha.
      <Text
        style={[
          styles.selectionText,
          { color: colors.text, maxWidth: Math.max(80, width - SELECTION_RESERVED) },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
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
        <Text
          style={[styles.titleText, { color: colors.text }, isCinema && { fontSize: titleSize }]}
          numberOfLines={1}
        >
          Contadores
        </Text>
        {/* Su ancho decide el tamaño de todos los títulos (para que nada se solape). */}
        <View onLayout={(e) => reportBadgeWidth(e.nativeEvent.layout.width)}>
          <TutorialTarget id="racha">
            <StreakBadge />
          </TutorialTarget>
        </View>
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
            {/* «+» grueso (petición del usuario). */}
            <MaterialCommunityIcons name="plus-thick" size={30} color={colors.background} />
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
    ) : query && hidden.length === 0 ? (
      <EmptyView title="Ningún contador coincide con la búsqueda" />
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
      {/* Sin conexión: lo que se sume se ve ya y se envía solo al volver. */}
      {online ? null : (
        <View style={[styles.offline, { backgroundColor: colors.elevated }]}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.offlineText, { color: colors.textMuted }]}>
            Sin conexión: lo que sumes se enviará al volver
          </Text>
        </View>
      )}
      {selecting ? (
        <FolderBar
          folders={folderList}
          selectedId={filters.folderId}
          onSelect={(folderId) => setFilters({ ...filters, folderId })}
          onLongPressFolder={folderOptions}
          onNewFolder={() => router.push('/carpetas/nueva')}
          layout={{
            value: counterLayout,
            onToggle: () => updateSettings({ counterLayout: grid ? 'list' : 'grid' }),
          }}
          selection={
            selecting
              ? {
                  selectedIds,
                  allIds: filtered.map((c) => c.id),
                  onToggle: toggleMany,
                }
              : undefined
          }
        />
      ) : null}
      {/* Lista en un ScrollView (no FlatList): igual que los bloques de Estadísticas, así el
          arrastre para reordenar va igual de fluido (sin celdas virtualizadas ni recortes). */}
      <ScrollView
        ref={listRef}
        style={styles.flex}
        // Siempre se puede subir hasta esconder las barras, aunque haya pocos contadores.
        contentContainerStyle={[
          styles.list,
          { minHeight: viewportHeight ? viewportHeight + barsHeight : undefined },
        ]}
        scrollEnabled={!drag.dragging}
        onScroll={onListScroll}
        scrollEventThrottle={16}
        onScrollEndDrag={(e) => {
          if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.2) {
            settleBars(e.nativeEvent.contentOffset.y);
          }
        }}
        onMomentumScrollEnd={(e) => settleBars(e.nativeEvent.contentOffset.y)}
        onLayout={(e) => {
          scrollMetrics.current.viewport = e.nativeEvent.layout.height;
          setViewportHeight(e.nativeEvent.layout.height);
          checkReveal();
          hideBarsInitially();
        }}
        onContentSizeChange={(_w, h) => {
          scrollMetrics.current.content = h;
          checkReveal();
          hideBarsInitially();
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            colors={[colors.primary]}
            refreshing={pull.refreshing}
            onRefresh={pull.onRefresh}
          />
        }
      >
        {/* Barras dentro de la lista (ver barsHeight). En el modo selección, la de carpetas
            va fija arriba para seleccionar en masa. */}
        <View
          style={styles.bars}
          onLayout={(e) => setBarsHeight(Math.ceil(e.nativeEvent.layout.height))}
        >
          {selecting ? null : (
            <FolderBar
              folders={folderList}
              selectedId={filters.folderId}
              onSelect={(folderId) => setFilters({ ...filters, folderId })}
              onLongPressFolder={folderOptions}
              onNewFolder={() => router.push('/carpetas/nueva')}
              layout={{
                value: counterLayout,
                onToggle: () => updateSettings({ counterLayout: grid ? 'list' : 'grid' }),
              }}
              selection={
                selecting
                  ? {
                      selectedIds,
                      allIds: filtered.map((c) => c.id),
                      onToggle: toggleMany,
                    }
                  : undefined
              }
            />
          )}
          {showSearch ? (
            <View style={styles.searchWrap}>
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
                  returnKeyType="search"
                  style={[styles.searchInput, { color: colors.text }]}
                />
                {query ? (
                  <Pressable
                    onPress={() => setQuery('')}
                    accessibilityRole="button"
                    accessibilityLabel="Borrar búsqueda"
                    hitSlop={10}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
        {shown.length === 0 ? (
          emptyView
        ) : grid ? (
          <View {...drag.containerProps} style={styles.gridWrap}>
            {shown.map((item) => renderCard(item, item.id === tutorialCardId, true))}
          </View>
        ) : (
          <View {...drag.containerProps} style={styles.cards}>
            {shown.map((item) => renderCard(item, item.id === tutorialCardId, true))}
          </View>
        )}
        {hidden.length > 0 ? (
          <View
            style={styles.hidden}
            onLayout={(e) => {
              // Dónde empieza «Ocultos» en la lista (solo con el desplegable cerrado: al
              // abrirlo, el título no se mueve).
              if (!showHidden) scrollMetrics.current.titleTop = e.nativeEvent.layout.y;
              checkReveal();
            }}
          >
            <Animated.View
              style={{ opacity: revealAnim }}
              pointerEvents={revealHidden ? 'auto' : 'none'}
            >
              {/* Sin bloque: un texto y la flecha para desplegar. */}
              <Pressable
                onPress={() => setShowHidden((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showHidden }}
                accessibilityLabel={`Ocultos, ${hidden.length}`}
                hitSlop={8}
                style={({ pressed }) => [styles.hiddenToggle, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.hiddenTitle, { color: colors.textMuted }]}>
                  Ocultos ({hidden.length})
                </Text>
                <Ionicons
                  name={showHidden ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            </Animated.View>
            {showHidden ? (
              grid ? (
                <View style={styles.gridWrap}>
                  {hidden.map((item) => (
                    <View key={item.id} style={{ width: gridItemWidth }}>
                      {renderCard(item)}
                    </View>
                  ))}
                </View>
              ) : (
                hidden.map((item) => renderCard(item))
              )
            ) : null}
          </View>
        ) : undefined}
      </ScrollView>
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

/** A partir de cuántos contadores sale el buscador. */
const SEARCH_FROM = 6;

const CARD_GAP = 10;
/** Ancho que ocupan la X y los botones de la cabecera en el modo selección. */
const SELECTION_RESERVED = 270;
const LIST_PADDING = 12;
/** Cuánto del título «Ocultos» tiene que verse para que aparezca. */
const REVEAL_MARGIN = 24;

const styles = StyleSheet.create({
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  offlineText: { fontSize: 13, fontFamily: fonts.detail },
  // Las barras van de borde a borde aunque la lista tenga margen.
  bars: { marginHorizontal: -LIST_PADDING, marginTop: -LIST_PADDING, paddingBottom: 2 },
  searchWrap: { paddingHorizontal: LIST_PADDING, paddingTop: 10 },
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
  flex: { flex: 1 },
  title: { flexDirection: 'row', alignItems: 'center', gap: isCinema ? TITLE_GAP : 24 },
  titleText: { ...screenTitleFont() },
  selectionText: { fontSize: 15, fontFamily: fonts.title },
  list: { padding: LIST_PADDING, gap: CARD_GAP, flexGrow: 1 },
  cards: { gap: CARD_GAP },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
  // Fusionar y filtros, más pegados al + (a la derecha).
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 14 },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginRight: 14 },
  close: { marginHorizontal: 12 },
  folderPlus: {
    position: 'absolute',
    right: -5,
    bottom: -3,
    borderRadius: 7,
  },
  // Más grande que antes (petición del usuario).
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { position: 'absolute', top: -1, right: -2, width: 9, height: 9, borderRadius: 5 },
  hidden: { gap: 10, marginTop: 6 },
  hiddenTitle: { fontSize: 15, fontFamily: fonts.title },
  hiddenToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
  },
});

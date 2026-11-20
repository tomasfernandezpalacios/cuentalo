import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { HeaderTitle } from '@/components/HeaderTitle';
import { ErrorView, LoadingView } from '@/components/StateViews';
import type { Entry, EntryInput } from '@/features/contadores/api';
import { CounterAvatar } from '@/features/contadores/components/CounterAvatar';
import { CounterChart } from '@/features/contadores/components/CounterChart';
import { CounterYearCalendar } from '@/features/contadores/components/CounterYearCalendar';
import { EntryDialog } from '@/features/contadores/components/EntryDialog';
import { EntryRow } from '@/features/contadores/components/EntryRow';
import { Leaderboard } from '@/features/contadores/components/Leaderboard';
import { QuickAddBar } from '@/features/contadores/components/QuickAddBar';
import {
  useCounter,
  useDeleteEntry,
  useEntries,
  useSetRemovedFromHome,
  useSetStreakShown,
  useUpdateEntry,
} from '@/features/contadores/hooks';
import { useCounterActions } from '@/features/contadores/useCounterActions';
import { getErrorMessage } from '@/lib/errors';
import { formatAmount, formatWithUnit, pluralize } from '@/lib/format';
import { displayFont, fonts, isCinema, proseFont, titleFont, useThemeColors } from '@/lib/theme';

// El diálogo está cerrado (null), creando un registro ('new') o editando uno (Entry).
type DialogState = null | 'new' | Entry;

export default function CounterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const counter = useCounter(id);
  const entries = useEntries(id, counter.data?.linkedCounterIds);
  const actions = useCounterActions();
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();
  const addToHome = useSetRemovedFromHome();
  const setStreakShown = useSetStreakShown();
  const [dialog, setDialog] = useState<DialogState>(null);
  // Si cuenta en varios grupos (contadores enlazados), de qué grupo se ve la clasificación.
  const [boardCounterId, setBoardCounterId] = useState<string | null>(null);

  if (counter.isPending) return <LoadingView />;
  if (counter.error) return <ErrorView error={counter.error} onRetry={counter.refetch} />;

  const {
    name,
    unit,
    emoji,
    photo_path: photoPath,
    total,
    myTotal,
    myEntryCount,
    myGroupTotal,
    displayTotal,
    group,
    canManage,
    is_common: isCommon,
    participantIds,
    linkedGroups,
    removedFromHome,
    streak,
  } = counter.data;
  const counterId = counter.data.id;
  const board = linkedGroups.find((g) => g.counterId === boardCounterId) ?? linkedGroups[0] ?? null;
  const editing = dialog !== null && dialog !== 'new' ? dialog : null;

  function showError(error: unknown) {
    appAlert('No se ha podido guardar', getErrorMessage(error));
  }

  function quickAdd(amount: number) {
    if (counter.data) actions.add(counter.data, { amount, loggedAt: new Date(), note: null });
  }

  function handleSave(input: EntryInput) {
    const options = { onSuccess: () => setDialog(null), onError: showError };
    if (editing) {
      updateEntry.mutate({ entry: editing, input }, options);
    } else {
      if (counter.data) actions.add(counter.data, input, options.onSuccess);
    }
  }

  function handleDelete() {
    if (!editing) return;
    appAlert('Borrar registro', '¿Seguro que quieres borrar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          deleteEntry.mutate(editing, { onSuccess: () => setDialog(null), onError: showError }),
      },
    ]);
  }

  const header = (
    <View style={styles.header}>
      <View
        style={styles.totalBox}
        accessible
        accessibilityLabel={[
          `${group ? 'Tú' : 'Total'}: ${formatWithUnit(myTotal, unit)}`,
          ...linkedGroups.map((g) => `Grupo ${g.group.name}: ${formatWithUnit(g.total, unit)}`),
        ].join('. ')}
      >
        <CounterAvatar emoji={emoji} name={name} photoPath={photoPath} size={72} />
        <Text style={[styles.total, { color: colors.text }]}>{formatAmount(displayTotal)}</Text>
        {unit ? <Text style={[styles.unit, { color: colors.textMuted }]}>{unit}</Text> : null}
        {/* Registros y récord de racha en una línea (la racha actual va junto al nombre). */}
        <Text style={[styles.count, { color: colors.textMuted }]}>
          {group ? 'Tú · ' : ''}
          {pluralize(myEntryCount, 'registro', 'registros')} · Récord de racha:{' '}
          {pluralize(streak.best, 'día', 'días')}
        </Text>
        {linkedGroups.map((g) => (
          <Text key={g.counterId} style={[styles.groupTotal, { color: colors.primary }]}>
            👥 {g.group.name}: {formatWithUnit(g.total, unit)} entre todos
          </Text>
        ))}
        {isCommon ? (
          <Text style={[styles.count, { color: colors.textMuted }]}>
            Común: cada suma se apunta a {pluralize(participantIds.length, 'persona', 'personas')}
          </Text>
        ) : null}
      </View>
      <QuickAddBar
        unit={unit}
        onAdd={quickAdd}
        onRemoveOne={() => actions.subtractOne(counter.data)}
        canRemove={isCommon ? total >= 1 : myGroupTotal >= 1}
        onCustom={() => setDialog('new')}
      />
      {/* «Mostrar racha» es de cada uno (su vista principal): aquí la puede cambiar cualquiera,
          también quien no administra un contador de grupo y no abre su formulario. */}
      <Pressable
        onPress={() =>
          setStreakShown.mutate(
            { ids: [counterId], shown: !counter.data.showStreak },
            { onError: showError },
          )
        }
        accessibilityRole="checkbox"
        accessibilityState={{ checked: counter.data.showStreak }}
        accessibilityLabel="Mostrar la racha en Mis contadores"
        hitSlop={8}
        style={({ pressed }) => [styles.showStreak, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons
          name={counter.data.showStreak ? 'checkbox' : 'square-outline'}
          size={20}
          color={counter.data.showStreak ? colors.primary : colors.textMuted}
        />
        <Text style={[styles.showStreakText, { color: colors.text }]}>
          Mostrar racha en Mis contadores
        </Text>
      </Pressable>
      {/* Tu evolución en este contador (solo lo tuyo); en los de grupo, debajo va la clasificación. */}
      <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
        {linkedGroups.length > 0 ? 'Tu evolución' : 'Evolución'}
      </Text>
      <CounterChart counterIds={counter.data.linkedCounterIds} name={name} unit={unit} />
      {/* El año en cuadraditos: los días en los que registré algo en este contador. */}
      <CounterYearCalendar counterIds={counter.data.linkedCounterIds} />
      {board ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
            Clasificación
          </Text>
          {linkedGroups.length > 1 ? (
            <View style={styles.groupChips}>
              {linkedGroups.map((g) => {
                const selected = g.counterId === board.counterId;
                return (
                  <Pressable
                    key={g.counterId}
                    onPress={() => setBoardCounterId(g.counterId)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    style={[
                      styles.groupChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.groupChipText,
                        { color: selected ? colors.onPrimary : colors.text },
                      ]}
                    >
                      👥 {g.group.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <Leaderboard counterId={board.counterId} unit={unit} streak={counter.data.showStreak} />
        </>
      ) : null}
      <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
        {linkedGroups.length > 0 ? 'Tu historial' : 'Historial'}
      </Text>
    </View>
  );

  function addBackToHome() {
    addToHome.mutate(
      { ids: [counterId], removed: false },
      {
        onSuccess: () =>
          appAlert(
            'Añadido a tu pantalla principal',
            `«${name}» vuelve a salir en Mis contadores.`,
          ),
        onError: showError,
      },
    );
  }

  // Botones de la cabecera. En Android, un contenedor de solo diseño puede «aplanarse» y dejar
  // los botones de la cabecera nativa sin recibir toques: si hay uno solo va suelto, y si hay
  // dos, el contenedor lleva collapsable={false}.
  const headerButtons = [
    removedFromHome ? (
      <Pressable
        key="home"
        onPress={addBackToHome}
        disabled={addToHome.isPending}
        accessibilityRole="button"
        accessibilityLabel="Añadir a la pantalla principal"
        hitSlop={12}
        style={({ pressed }) => ({ opacity: pressed || addToHome.isPending ? 0.5 : 1 })}
      >
        <Ionicons name="home-outline" size={24} color={colors.primary} />
      </Pressable>
    ) : null,
    // El administrador edita el contador (o su versión); los demás miembros, su versión personal.
    canManage || group ? (
      <Pressable
        key="edit"
        onPress={() =>
          router.push({ pathname: '/contadores/[id]/editar', params: { id: counterId } })
        }
        accessibilityRole="button"
        accessibilityLabel="Editar contador"
        hitSlop={12}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <Ionicons name="create-outline" size={24} color={colors.primary} />
      </Pressable>
    ) : null,
  ].filter((button) => button !== null);
  const headerRight =
    headerButtons.length === 0
      ? undefined
      : () =>
          headerButtons.length === 1 ? (
            headerButtons[0]
          ) : (
            <View collapsable={false} style={styles.headerActions}>
              {headerButtons}
            </View>
          );

  const streakColor = streak.todayDone ? colors.flame : colors.textMuted;
  const streakBadge = (
    <View
      style={styles.streakRow}
      accessible
      accessibilityLabel={`Racha de ${pluralize(streak.current, 'día', 'días')}${streak.todayDone ? '' : ', hoy aún sin mantener'}`}
    >
      <Ionicons name="flame" size={22} color={streakColor} />
      <Text style={[styles.streakText, { color: streakColor }]}>{streak.current}</Text>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: name,
          // A la derecha del nombre, siempre, mi racha en este contador (en color si hoy ya se
          // ha mantenido), aunque no tenga marcado «Mostrar racha».
          ...(isCinema
            ? {
                headerTitle: ({ children }: { children: string }) => (
                  <HeaderTitle badge={streakBadge}>{children}</HeaderTitle>
                ),
              }
            : {}),
          headerRight,
        }}
      />
      <FlatList
        data={entries.data ?? []}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => (
          <EntryRow entry={item} unit={unit} onPress={() => setDialog(item)} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            {entries.isPending
              ? 'Cargando…'
              : entries.error
                ? getErrorMessage(entries.error)
                : 'Todavía no hay registros. ¡Pulsa un botón para empezar!'}
          </Text>
        }
        contentContainerStyle={styles.list}
      />
      <EntryDialog
        visible={dialog !== null}
        unit={unit}
        entry={editing}
        saving={actions.saving || updateEntry.isPending}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setDialog(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Pegada a los botones (el hueco del header es de 20).
  showStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    minHeight: 36,
    marginTop: -10,
  },
  showStreakText: { fontSize: 14, fontFamily: fonts.detail },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  streakText: { fontSize: 20, fontFamily: fonts.title },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  flex: { flex: 1 },
  list: { padding: 16 },
  header: { gap: 20, marginBottom: 8 },
  totalBox: { alignItems: 'center', paddingVertical: 16, gap: 4 },
  total: { ...displayFont(56) },
  unit: { fontSize: 18, fontFamily: fonts.detail },
  count: { fontSize: 14, marginTop: 4, fontFamily: fonts.detail, textAlign: 'center' },
  groupTotal: { fontSize: 15, marginTop: 6, fontFamily: fonts.title, textAlign: 'center' },
  groupChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  groupChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  groupChipText: { fontSize: 14, fontFamily: fonts.title },
  sectionTitle: { ...titleFont(18), marginTop: 8 },
  empty: { ...proseFont(15), textAlign: 'center', paddingVertical: 24 },
});

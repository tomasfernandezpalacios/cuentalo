import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { ErrorView, LoadingView } from '@/components/StateViews';
import type { Entry, EntryInput } from '@/features/contadores/api';
import { CounterAvatar } from '@/features/contadores/components/CounterAvatar';
import { EntryDialog } from '@/features/contadores/components/EntryDialog';
import { EntryRow } from '@/features/contadores/components/EntryRow';
import { Leaderboard } from '@/features/contadores/components/Leaderboard';
import { QuickAddBar } from '@/features/contadores/components/QuickAddBar';
import {
  useCounter,
  useDeleteEntry,
  useEntries,
  useSetRemovedFromHome,
  useUpdateEntry,
} from '@/features/contadores/hooks';
import { useCounterActions } from '@/features/contadores/useCounterActions';
import { getErrorMessage } from '@/lib/errors';
import { formatAmount, formatWithUnit, pluralize } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

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
  const [dialog, setDialog] = useState<DialogState>(null);
  // Si cuenta en varios grupos (contadores enlazados), de qué grupo se ve la clasificación.
  const [boardCounterId, setBoardCounterId] = useState<string | null>(null);

  if (counter.isPending) return <LoadingView />;
  if (counter.error) return <ErrorView error={counter.error} onRetry={counter.refetch} />;

  const {
    name,
    unit,
    emoji,
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
        <CounterAvatar emoji={emoji} name={name} size={72} />
        <Text style={[styles.total, { color: colors.text }]}>{formatAmount(displayTotal)}</Text>
        {unit ? <Text style={[styles.unit, { color: colors.textMuted }]}>{unit}</Text> : null}
        <Text style={[styles.count, { color: colors.textMuted }]}>
          {group ? 'Tú · ' : ''}
          {pluralize(myEntryCount, 'registro', 'registros')}
        </Text>
        {linkedGroups.map((g) => (
          <Text key={g.counterId} style={[styles.groupTotal, { color: colors.primary }]}>
            👥 {g.group.name}: {formatWithUnit(g.total, unit)} entre todos
          </Text>
        ))}
        {isCommon ? (
          <Text style={[styles.count, { color: colors.textMuted }]}>
            Común: cada +1 se suma a {pluralize(participantIds.length, 'persona', 'personas')}
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
          <Leaderboard counterId={board.counterId} unit={unit} />
        </>
      ) : null}
      <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
        {linkedGroups.length > 0 ? 'Tu historial' : 'Historial'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: name,
          headerRight: () => (
            <View style={styles.headerActions}>
              {removedFromHome ? (
                <Pressable
                  onPress={() =>
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
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Añadir a la pantalla principal"
                  hitSlop={12}
                >
                  <Ionicons name="home-outline" size={24} color={colors.primary} />
                </Pressable>
              ) : null}
              {canManage ? (
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/contadores/[id]/editar', params: { id: counterId } })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Editar contador"
                  hitSlop={12}
                >
                  <Ionicons name="create-outline" size={24} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
          ),
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
                : 'Todavía no hay registros. ¡Pulsa +1 para empezar!'}
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  flex: { flex: 1 },
  list: { padding: 16 },
  header: { gap: 20, marginBottom: 8 },
  totalBox: { alignItems: 'center', paddingVertical: 16, gap: 4 },
  total: { fontSize: 56, fontFamily: fonts.title },
  unit: { fontSize: 18, fontFamily: fonts.detail },
  count: { fontSize: 14, marginTop: 4, fontFamily: fonts.detail },
  groupTotal: { fontSize: 15, marginTop: 6, fontFamily: fonts.title, textAlign: 'center' },
  groupChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  groupChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  groupChipText: { fontSize: 14, fontFamily: fonts.title },
  sectionTitle: { fontSize: 18, fontFamily: fonts.title, marginTop: 8 },
  empty: { textAlign: 'center', paddingVertical: 24, fontFamily: fonts.detail },
});

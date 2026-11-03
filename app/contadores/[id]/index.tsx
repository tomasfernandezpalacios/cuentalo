import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorView, LoadingView } from '@/components/StateViews';
import type { Entry, EntryInput } from '@/features/contadores/api';
import { CounterAvatar } from '@/features/contadores/components/CounterAvatar';
import { EntryDialog } from '@/features/contadores/components/EntryDialog';
import { EntryRow } from '@/features/contadores/components/EntryRow';
import { Leaderboard } from '@/features/contadores/components/Leaderboard';
import { QuickAddBar } from '@/features/contadores/components/QuickAddBar';
import {
  useAddEntry,
  useCounter,
  useDeleteEntry,
  useEntries,
  useRemoveOne,
  useUpdateEntry,
} from '@/features/contadores/hooks';
import { getErrorMessage } from '@/lib/errors';
import { formatAmount, formatWithUnit, pluralize } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

// El diálogo está cerrado (null), creando un registro ('new') o editando uno (Entry).
type DialogState = null | 'new' | Entry;

export default function CounterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const counter = useCounter(id);
  const entries = useEntries(id);
  const addEntry = useAddEntry();
  const removeOne = useRemoveOne();
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();
  const [dialog, setDialog] = useState<DialogState>(null);

  if (counter.isPending) return <LoadingView />;
  if (counter.error) return <ErrorView error={counter.error} onRetry={counter.refetch} />;

  const {
    name,
    unit,
    emoji,
    total,
    myTotal,
    myEntryCount,
    displayTotal,
    group,
    canManage,
    is_common: isCommon,
    participantIds,
  } = counter.data;
  const editing = dialog !== null && dialog !== 'new' ? dialog : null;

  function showError(error: unknown) {
    Alert.alert('No se ha podido guardar', getErrorMessage(error));
  }

  function quickAdd(amount: number) {
    addEntry.mutate(
      { counterId: id, input: { amount, loggedAt: new Date(), note: null } },
      { onError: showError },
    );
  }

  function handleSave(input: EntryInput) {
    const options = { onSuccess: () => setDialog(null), onError: showError };
    if (editing) {
      updateEntry.mutate({ id: editing.id, input }, options);
    } else {
      addEntry.mutate({ counterId: id, input }, options);
    }
  }

  function handleDelete() {
    if (!editing) return;
    Alert.alert('Borrar registro', '¿Seguro que quieres borrar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          deleteEntry.mutate(editing.id, { onSuccess: () => setDialog(null), onError: showError }),
      },
    ]);
  }

  const header = (
    <View style={styles.header}>
      <View
        style={styles.totalBox}
        accessible
        accessibilityLabel={
          group
            ? `Tú: ${formatWithUnit(myTotal, unit)}. Grupo ${group.name}: ${formatWithUnit(total, unit)}`
            : `Total: ${formatWithUnit(myTotal, unit)}`
        }
      >
        <CounterAvatar emoji={emoji} name={name} size={72} />
        <Text style={[styles.total, { color: colors.text }]}>{formatAmount(displayTotal)}</Text>
        {unit ? <Text style={[styles.unit, { color: colors.textMuted }]}>{unit}</Text> : null}
        <Text style={[styles.count, { color: colors.textMuted }]}>
          {group ? 'Tú · ' : ''}
          {pluralize(myEntryCount, 'registro', 'registros')}
        </Text>
        {group ? (
          <Text style={[styles.groupTotal, { color: colors.primary }]}>
            👥 {group.name}: {formatWithUnit(total, unit)} entre todos
          </Text>
        ) : null}
        {isCommon ? (
          <Text style={[styles.count, { color: colors.textMuted }]}>
            Común: cada +1 se suma a {pluralize(participantIds.length, 'persona', 'personas')}
          </Text>
        ) : null}
      </View>
      <QuickAddBar
        unit={unit}
        onAdd={quickAdd}
        onRemoveOne={() => removeOne.mutate(id, { onError: showError })}
        canRemove={isCommon ? total >= 1 : myTotal >= 1}
        onCustom={() => setDialog('new')}
      />
      {group ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
            Clasificación
          </Text>
          <Leaderboard counterId={id} unit={unit} />
        </>
      ) : null}
      <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
        {group ? 'Tu historial' : 'Historial'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: name,
          headerRight: () =>
            canManage ? (
              <Pressable
                onPress={() => router.push({ pathname: '/contadores/[id]/editar', params: { id } })}
                accessibilityRole="button"
                accessibilityLabel="Editar contador"
                hitSlop={12}
              >
                <Ionicons name="create-outline" size={24} color={colors.primary} />
              </Pressable>
            ) : null,
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
        saving={addEntry.isPending || updateEntry.isPending}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setDialog(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16 },
  header: { gap: 20, marginBottom: 8 },
  totalBox: { alignItems: 'center', paddingVertical: 16, gap: 4 },
  total: { fontSize: 56, fontFamily: fonts.title },
  unit: { fontSize: 18, fontFamily: fonts.detail },
  count: { fontSize: 14, marginTop: 4, fontFamily: fonts.detail },
  groupTotal: { fontSize: 15, marginTop: 6, fontFamily: fonts.title, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontFamily: fonts.title, marginTop: 8 },
  empty: { textAlign: 'center', paddingVertical: 24, fontFamily: fonts.detail },
});

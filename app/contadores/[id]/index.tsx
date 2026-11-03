import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorView, LoadingView } from '@/components/StateViews';
import type { Entry, EntryInput } from '@/features/contadores/api';
import { EntryDialog } from '@/features/contadores/components/EntryDialog';
import { EntryRow } from '@/features/contadores/components/EntryRow';
import { QuickAddBar } from '@/features/contadores/components/QuickAddBar';
import {
  useAddEntry,
  useCounter,
  useDeleteEntry,
  useEntries,
  useUpdateEntry,
} from '@/features/contadores/hooks';
import { getErrorMessage } from '@/lib/errors';
import { formatAmount, pluralize } from '@/lib/format';
import { useThemeColors } from '@/lib/theme';

// El diálogo está cerrado (null), creando un registro ('new') o editando uno (Entry).
type DialogState = null | 'new' | Entry;

export default function CounterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const counter = useCounter(id);
  const entries = useEntries(id);
  const addEntry = useAddEntry(id);
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();
  const [dialog, setDialog] = useState<DialogState>(null);

  if (counter.isPending) return <LoadingView />;
  if (counter.error) return <ErrorView error={counter.error} onRetry={counter.refetch} />;

  const { name, unit, total, entryCount } = counter.data;
  const editing = dialog !== null && dialog !== 'new' ? dialog : null;

  function showError(error: unknown) {
    Alert.alert('No se ha podido guardar', getErrorMessage(error));
  }

  function quickAdd(amount: number) {
    addEntry.mutate({ amount, loggedAt: new Date(), note: null }, { onError: showError });
  }

  function handleSave(input: EntryInput) {
    const options = { onSuccess: () => setDialog(null), onError: showError };
    if (editing) {
      updateEntry.mutate({ id: editing.id, input }, options);
    } else {
      addEntry.mutate(input, options);
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
        accessibilityLabel={`Total: ${formatAmount(total)} ${unit}`}
      >
        <Text style={[styles.total, { color: colors.text }]}>{formatAmount(total)}</Text>
        <Text style={[styles.unit, { color: colors.textMuted }]}>{unit}</Text>
        <Text style={[styles.count, { color: colors.textMuted }]}>
          {pluralize(entryCount, 'registro', 'registros')}
        </Text>
      </View>
      <QuickAddBar unit={unit} onAdd={quickAdd} onCustom={() => setDialog('new')} />
      <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
        Historial
      </Text>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/contadores/[id]/editar', params: { id } })}
              accessibilityRole="button"
              accessibilityLabel="Editar contador"
              hitSlop={12}
            >
              <Ionicons name="create-outline" size={24} color={colors.primary} />
            </Pressable>
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
  totalBox: { alignItems: 'center', paddingVertical: 16 },
  total: { fontSize: 56, fontWeight: '800' },
  unit: { fontSize: 18 },
  count: { fontSize: 14, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  empty: { textAlign: 'center', paddingVertical: 24 },
});

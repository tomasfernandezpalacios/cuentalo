import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { CounterForm } from '@/features/contadores/components/CounterForm';
import { useCounter, useDeleteCounter, useUpdateCounter } from '@/features/contadores/hooks';
import { getErrorMessage } from '@/lib/errors';

export default function EditCounterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const counter = useCounter(id);
  const update = useUpdateCounter(id);
  const remove = useDeleteCounter(id);

  if (counter.isPending) return <LoadingView />;
  if (counter.error) return <ErrorView error={counter.error} onRetry={counter.refetch} />;

  const { name, unit, archived } = counter.data;

  function toggleArchived() {
    update.mutate(
      { archived: !archived },
      {
        onSuccess: () => router.back(),
        onError: (error) => Alert.alert('Error', getErrorMessage(error)),
      },
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Borrar contador',
      `Se borrarán «${name}» y todos sus registros. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () =>
            remove.mutate(undefined, {
              onSuccess: () => router.dismissTo('/'),
              onError: (error) => Alert.alert('Error', getErrorMessage(error)),
            }),
        },
      ],
    );
  }

  return (
    <CounterForm
      initial={{ name, unit: unit ?? '' }}
      submitTitle="Guardar cambios"
      saving={update.isPending}
      error={update.error}
      onSubmit={(input) => update.mutate(input, { onSuccess: () => router.back() })}
      footer={
        <View style={styles.footer}>
          <AppButton
            title={archived ? 'Desarchivar' : 'Archivar'}
            variant="secondary"
            onPress={toggleArchived}
          />
          <AppButton
            title="Borrar contador"
            variant="danger"
            onPress={confirmDelete}
            loading={remove.isPending}
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  footer: { gap: 12, marginTop: 24 },
});

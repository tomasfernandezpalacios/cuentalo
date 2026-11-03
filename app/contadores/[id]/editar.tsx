import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { CounterForm } from '@/features/contadores/components/CounterForm';
import {
  useCounter,
  useDeleteCounter,
  useSetParticipants,
  useUpdateCounter,
} from '@/features/contadores/hooks';
import { getErrorMessage } from '@/lib/errors';

export default function EditCounterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const counter = useCounter(id);
  const update = useUpdateCounter(id);
  const remove = useDeleteCounter(id);
  const setParticipants = useSetParticipants(id);

  if (counter.isPending) return <LoadingView />;
  if (counter.error) return <ErrorView error={counter.error} onRetry={counter.refetch} />;

  const { name, unit, emoji, archived, group, is_common, participantIds } = counter.data;

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
      initial={{ name, unit: unit ?? '', emoji: emoji ?? '' }}
      sharedGroupName={group?.name}
      submitTitle="Guardar cambios"
      saving={update.isPending || setParticipants.isPending}
      error={update.error ?? setParticipants.error}
      sharedGroupId={group?.id}
      initialParticipantIds={is_common ? participantIds : null}
      onSubmit={async (input, _groupId, newParticipants) => {
        try {
          await update.mutateAsync(input);
          if (newParticipants) await setParticipants.mutateAsync(newParticipants);
          router.back();
        } catch {
          // El error se muestra en el formulario (update.error / setParticipants.error).
        }
      }}
      footer={
        <View style={styles.footer}>
          <AppButton
            title={archived ? 'Desarchivar' : 'Archivar'}
            variant="secondary"
            onPress={toggleArchived}
          />
          {/* Los compartidos no se borran (se perderían los registros de todos): se archivan. */}
          {group ? null : (
            <AppButton
              title="Borrar contador"
              variant="danger"
              onPress={confirmDelete}
              loading={remove.isPending}
            />
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  footer: { gap: 12, marginTop: 24 },
});

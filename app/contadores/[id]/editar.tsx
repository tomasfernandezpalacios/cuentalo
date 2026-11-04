import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { CounterForm } from '@/features/contadores/components/CounterForm';
import {
  useCounter,
  useDeleteCounters,
  useSetParticipants,
  useUpdateCounter,
} from '@/features/contadores/hooks';
import { confirmDeleteCounters } from '@/features/contadores/confirmDelete';
import { getErrorMessage } from '@/lib/errors';

export default function EditCounterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const counter = useCounter(id);
  const update = useUpdateCounter(id);
  const remove = useDeleteCounters();
  const setParticipants = useSetParticipants(id);

  if (counter.isPending) return <LoadingView />;
  if (counter.error) return <ErrorView error={counter.error} onRetry={counter.refetch} />;

  const {
    sharedName: name,
    sharedEmoji: emoji,
    unit,
    archived,
    group,
    is_common,
    participantIds,
  } = counter.data;

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
    if (!counter.data) return;
    const data = counter.data;
    confirmDeleteCounters([data], () =>
      remove.mutate([data], {
        onSuccess: () => router.dismissTo('/'),
        onError: (error) => Alert.alert('Error', getErrorMessage(error)),
      }),
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
          {/* Solo el administrador llega aquí; en uno de grupo, borrar solo lo saca del grupo. */}
          <AppButton
            title={group ? 'Borrar del grupo' : 'Borrar contador'}
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

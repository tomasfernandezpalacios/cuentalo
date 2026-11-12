import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { CounterForm } from '@/features/contadores/components/CounterForm';
import {
  useCounter,
  useDeleteCounters,
  useSetHidden,
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
  const setHiddenMutation = useSetHidden();

  if (counter.isPending) return <LoadingView />;
  if (counter.error) return <ErrorView error={counter.error} onRetry={counter.refetch} />;

  const {
    sharedName: name,
    sharedEmoji: emoji,
    unit,
    hidden,
    group,
    is_common,
    participantIds,
  } = counter.data;

  // Ocultar es personal: lo manda al desplegable «Ocultos» del final de mi lista.
  function toggleHidden() {
    // Al instante (optimista): se cierra ya y se guarda por detrás.
    setHiddenMutation.mutate(
      { ids: [id], hidden: !hidden },
      { onError: (error) => appAlert('Error', getErrorMessage(error)) },
    );
    router.back();
  }

  function confirmDelete() {
    if (!counter.data) return;
    const data = counter.data;
    confirmDeleteCounters([data], () =>
      remove.mutate([data], {
        onSuccess: () => router.dismissTo('/'),
        onError: (error) => appAlert('Error', getErrorMessage(error)),
      }),
    );
  }

  return (
    <CounterForm
      initial={{
        name,
        unit: unit ?? '',
        emoji: emoji ?? '',
        hiddenFromFriends: counter.data.hidden_from_friends,
        streakEnabled: counter.data.streak_enabled,
      }}
      initialPhotoPath={counter.data.photo_path ?? null}
      sharedGroupName={group?.name}
      submitTitle="Guardar cambios"
      submitInHeader
      saving={update.isPending || setParticipants.isPending}
      error={update.error ?? setParticipants.error}
      sharedGroupId={group?.id}
      initialParticipantIds={is_common ? participantIds : null}
      // Se cierra al instante: el cambio ya se ve en la lista y el detalle (optimista) y se
      // guarda por detrás. Si falla, se avisa y se vuelve a lo de antes.
      onSubmit={(input, _groupId, newParticipants) => {
        const onError = (error: unknown) =>
          appAlert('No se ha podido guardar', getErrorMessage(error));
        update.mutate(input, { onError });
        if (newParticipants) setParticipants.mutate(newParticipants, { onError });
        router.back();
      }}
      footer={
        <View style={styles.footer}>
          <AppButton
            title={hidden ? 'Mostrar en mi lista' : 'Ocultar'}
            variant="secondary"
            onPress={toggleHidden}
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

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { planAlias } from '@/features/contadores/alias';
import { CounterForm } from '@/features/contadores/components/CounterForm';
import {
  useCounter,
  useDeleteCounters,
  useRemoveCounterAlias,
  useSaveCounterAlias,
  useSetHidden,
  useSetParticipants,
  useSetStreakShown,
  useUpdateCounter,
} from '@/features/contadores/hooks';
import { confirmDeleteCounters } from '@/features/contadores/confirmDelete';
import { getErrorMessage } from '@/lib/errors';
import { proseFont, useThemeColors } from '@/lib/theme';

type Mode = 'all' | 'mine';

/**
 * Editar un contador. En uno de grupo hay dos maneras (petición del usuario):
 *  - «Para mí»: mi versión personal (nombre, imagen y unidad) que solo veo yo, fuera del grupo.
 *    Es lo único que puede editar quien no lo administra.
 *  - «Para todos» (solo el administrador): el contador del grupo, como siempre. A los demás
 *    miembros les llega un aviso; quien tenga su versión personal la sigue viendo.
 */
export default function EditCounterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const counter = useCounter(id);
  const update = useUpdateCounter(id);
  const saveAlias = useSaveCounterAlias(id);
  const removeAlias = useRemoveCounterAlias(id);
  const setStreakShown = useSetStreakShown();
  const remove = useDeleteCounters();
  const setParticipants = useSetParticipants(id);
  const setHiddenMutation = useSetHidden();
  const [chosenMode, setChosenMode] = useState<Mode>('all');

  if (counter.isPending) return <LoadingView />;
  if (counter.error) return <ErrorView error={counter.error} onRetry={counter.refetch} />;

  const data = counter.data;
  const { hidden, group, is_common, participantIds, canManage, alias } = data;
  // Quien no administra un contador de grupo solo puede hacer su versión personal.
  const mode: Mode = group && !canManage ? 'mine' : group ? chosenMode : 'all';

  const onError = (error: unknown) => appAlert('No se ha podido guardar', getErrorMessage(error));

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
    confirmDeleteCounters([data], () =>
      remove.mutate([data], {
        onSuccess: () => router.dismissTo('/'),
        onError: (error) => appAlert('Error', getErrorMessage(error)),
      }),
    );
  }

  function resetToGroup() {
    removeAlias.mutate(alias, { onError });
    router.back();
  }

  const top = group ? (
    <View style={styles.top}>
      {canManage ? (
        <SegmentedControl
          options={[
            { value: 'all', label: 'Para todos' },
            { value: 'mine', label: 'Para mí' },
          ]}
          value={mode}
          onChange={setChosenMode}
        />
      ) : null}
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {mode === 'mine'
          ? `Tu versión de «${data.sharedName}»: el nombre, la imagen y la unidad que pongas solo los ves tú. Dentro de ${group.name} se ve como lo dejó su administrador.`
          : `Cambia el contador para todo ${group.name}. Los miembros reciben un aviso; quien tenga su propia versión la sigue viendo fuera del grupo.`}
      </Text>
    </View>
  ) : null;

  const footer = (
    <View style={styles.footer}>
      {mode === 'mine' && alias ? (
        <AppButton title="Ver como en el grupo" variant="secondary" onPress={resetToGroup} />
      ) : null}
      <AppButton
        title={hidden ? 'Mostrar en mi lista' : 'Ocultar'}
        variant="secondary"
        onPress={toggleHidden}
      />
      {/* Solo el administrador borra; en uno de grupo, borrar solo lo saca del grupo. */}
      {canManage && mode === 'all' ? (
        <AppButton
          title={group ? 'Borrar del grupo' : 'Borrar contador'}
          variant="danger"
          onPress={confirmDelete}
          loading={remove.isPending}
        />
      ) : null}
    </View>
  );

  if (mode === 'mine') {
    // Mi versión: lo que veo ahora (personal si la tengo; si no, la del grupo).
    return (
      <CounterForm
        key="mine"
        personal
        top={top}
        initial={{
          name: data.name,
          unit: data.unit ?? '',
          emoji: data.emoji ?? '',
          hiddenFromFriends: data.hidden_from_friends,
          showStreak: data.showStreak,
        }}
        initialPhotoPath={data.photo_path ?? null}
        sharedGroupName={group?.name}
        submitTitle="Guardar"
        submitInHeader
        saving={saveAlias.isPending}
        error={saveAlias.error}
        onSubmit={(input) => {
          const plan = planAlias(
            { name: input.name, emoji: input.emoji, unit: input.unit, photo: input.photo },
            {
              name: data.sharedName,
              emoji: data.sharedEmoji,
              unit: data.sharedUnit,
              photoPath: data.sharedPhotoPath,
            },
            alias,
          );
          saveAlias.mutate({ plan, previous: alias }, { onError });
          if (input.showStreak !== data.showStreak) {
            setStreakShown.mutate({ ids: [id], shown: input.showStreak }, { onError });
          }
          router.back();
        }}
        footer={footer}
      />
    );
  }

  return (
    <CounterForm
      key="all"
      top={top}
      initial={{
        name: data.sharedName,
        unit: data.sharedUnit ?? '',
        emoji: data.sharedEmoji ?? '',
        hiddenFromFriends: data.hidden_from_friends,
        showStreak: data.showStreak,
      }}
      initialPhotoPath={data.sharedPhotoPath}
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
        update.mutate(input, { onError });
        if (newParticipants) setParticipants.mutate(newParticipants, { onError });
        router.back();
      }}
      footer={footer}
    />
  );
}

const styles = StyleSheet.create({
  top: { gap: 10 },
  hint: { ...proseFont(14, 20) },
  footer: { gap: 12, marginTop: 24 },
});

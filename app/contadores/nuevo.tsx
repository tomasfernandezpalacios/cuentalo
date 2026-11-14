import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { CounterForm } from '@/features/contadores/components/CounterForm';
import { useCreateCounter } from '@/features/contadores/hooks';
import { useMyGroups } from '@/features/social/hooks';
import { markStackLeaving, useTutorialStackScreen } from '@/features/tutorial/navigation';
import {
  beginTutorialLeave,
  cancelTutorialLeave,
  tutorialEvent,
  useTutorialValue,
} from '@/features/tutorial/store';

export default function NewCounterScreen() {
  // Desde la pantalla de un grupo se llega con ?grupo=<id> para crearlo ya compartido.
  const { grupo } = useLocalSearchParams<{ grupo?: string }>();
  const create = useCreateCounter();
  const groups = useMyGroups();
  const activeGroups = (groups.data ?? []).filter((g) => g.status === 'active');
  // Durante el tutorial: «Mi primer contador» (nombre fijo) y, al crear, de vuelta a la lista.
  const stepId = useTutorialValue((_, step) => step?.id ?? null);
  const inTutorial = stepId === 'create' || stepId === 'name' || stepId === 'submit';
  // El tutorial espera a que esta pantalla termine de abrirse (o de cerrarse) para iluminar.
  useTutorialStackScreen();

  // Paso «Toca el +»: ya estamos en el formulario, el tutorial sigue aquí.
  useEffect(() => {
    if (stepId === 'create') tutorialEvent('form-opened');
  }, [stepId]);

  return (
    <CounterForm
      submitTitle="Crear contador"
      saving={create.isPending}
      error={create.error}
      groups={activeGroups}
      initialGroupId={grupo ?? null}
      simple={inTutorial}
      onSubmit={(input, groupId, participantIds) => {
        // En el tutorial, el bocadillo se va ya al tocar (crear tarda lo que tarde el servidor).
        if (inTutorial) beginTutorialLeave('counter-created');
        create.mutate(
          { input, groupId, participantIds },
          {
            onError: () => cancelTutorialLeave(),
            onSuccess: (counter) => {
              if (inTutorial) {
                markStackLeaving();
                tutorialEvent('counter-created', counter.id);
                router.back();
              } else {
                router.replace({ pathname: '/contadores/[id]', params: { id: counter.id } });
              }
            },
          },
        );
      }}
    />
  );
}

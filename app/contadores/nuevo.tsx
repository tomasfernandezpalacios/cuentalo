import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { CounterForm } from '@/features/contadores/components/CounterForm';
import { useCreateCounter } from '@/features/contadores/hooks';
import { useMyGroups } from '@/features/social/hooks';
import { tutorialEvent, useTutorial } from '@/features/tutorial/store';

export default function NewCounterScreen() {
  // Desde la pantalla de un grupo se llega con ?grupo=<id> para crearlo ya compartido.
  const { grupo } = useLocalSearchParams<{ grupo?: string }>();
  const create = useCreateCounter();
  const groups = useMyGroups();
  const activeGroups = (groups.data ?? []).filter((g) => g.status === 'active');
  // Durante el tutorial: contador sencillo guiado y, al crear, de vuelta a la lista («Sumar»).
  const tutorial = useTutorial();
  const stepId = tutorial.step?.id;
  const inTutorial = stepId === 'create' || stepId === 'pick-idea' || stepId === 'submit';

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
      onSubmit={(input, groupId, participantIds) =>
        create.mutate(
          { input, groupId, participantIds },
          {
            onSuccess: (counter) => {
              if (inTutorial) {
                router.back();
                tutorialEvent('counter-created');
              } else {
                router.replace({ pathname: '/contadores/[id]', params: { id: counter.id } });
              }
            },
          },
        )
      }
    />
  );
}

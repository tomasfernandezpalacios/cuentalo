import { router, useLocalSearchParams } from 'expo-router';

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
  // Durante el tutorial: ideas de un toque y, al crear, de vuelta a la lista (paso «Sumar»).
  const tutorial = useTutorial();
  const inTutorial = tutorial.step?.id === 'create';

  return (
    <CounterForm
      submitTitle="Crear contador"
      saving={create.isPending}
      error={create.error}
      groups={activeGroups}
      initialGroupId={grupo ?? null}
      suggestions={inTutorial}
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

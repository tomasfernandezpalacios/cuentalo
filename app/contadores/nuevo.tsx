import { router, useLocalSearchParams } from 'expo-router';

import { CounterForm } from '@/features/contadores/components/CounterForm';
import { useCreateCounter } from '@/features/contadores/hooks';
import { useCounterOrder, useSetCounterOrder } from '@/features/perfil/birthDate';
import { useMyGroups } from '@/features/social/hooks';
import { withFirst } from '@/lib/reorder';

export default function NewCounterScreen() {
  // Desde la pantalla de un grupo se llega con ?grupo=<id> para crearlo ya compartido.
  const { grupo } = useLocalSearchParams<{ grupo?: string }>();
  const create = useCreateCounter();
  const groups = useMyGroups();
  const activeGroups = (groups.data ?? []).filter((g) => g.status === 'active');
  const counterOrder = useCounterOrder();
  const setCounterOrder = useSetCounterOrder();

  return (
    <CounterForm
      submitTitle="Crear contador"
      saving={create.isPending}
      error={create.error}
      groups={activeGroups}
      initialGroupId={grupo ?? null}
      onSubmit={(input, groupId, participantIds) =>
        create.mutate(
          { input, groupId, participantIds },
          {
            onSuccess: (counter) => {
              // El contador nuevo, el primero de «Mis contadores» (en filas y en bloques).
              setCounterOrder.mutate(withFirst(counterOrder, counter.id));
              router.replace({ pathname: '/contadores/[id]', params: { id: counter.id } });
            },
          },
        )
      }
    />
  );
}

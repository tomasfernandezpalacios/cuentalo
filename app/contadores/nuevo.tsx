import { router, useLocalSearchParams } from 'expo-router';

import { CounterForm } from '@/features/contadores/components/CounterForm';
import { useCreateCounter } from '@/features/contadores/hooks';
import { useMyGroups } from '@/features/social/hooks';

export default function NewCounterScreen() {
  // Desde la pantalla de un grupo se llega con ?grupo=<id> para crearlo ya compartido.
  const { grupo } = useLocalSearchParams<{ grupo?: string }>();
  const create = useCreateCounter();
  const groups = useMyGroups();
  const activeGroups = (groups.data ?? []).filter((g) => g.status === 'active');

  return (
    <CounterForm
      submitTitle="Crear contador"
      saving={create.isPending}
      error={create.error}
      groups={activeGroups}
      initialGroupId={grupo ?? null}
      onSubmit={(input, groupId) =>
        create.mutate(
          { input, groupId },
          {
            onSuccess: (counter) =>
              router.replace({ pathname: '/contadores/[id]', params: { id: counter.id } }),
          },
        )
      }
    />
  );
}

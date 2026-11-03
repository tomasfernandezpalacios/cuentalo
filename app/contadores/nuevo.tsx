import { router } from 'expo-router';

import { CounterForm } from '@/features/contadores/components/CounterForm';
import { useCreateCounter } from '@/features/contadores/hooks';

export default function NewCounterScreen() {
  const create = useCreateCounter();

  return (
    <CounterForm
      submitTitle="Crear contador"
      saving={create.isPending}
      error={create.error}
      onSubmit={(input) =>
        create.mutate(input, {
          onSuccess: (counter) =>
            router.replace({ pathname: '/contadores/[id]', params: { id: counter.id } }),
        })
      }
    />
  );
}

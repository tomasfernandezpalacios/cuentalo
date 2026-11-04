import { router, useLocalSearchParams } from 'expo-router';

import { ErrorView, LoadingView } from '@/components/StateViews';
import { GroupForm } from '@/features/social/components/GroupForm';
import { useGroup, useUpdateGroup } from '@/features/social/hooks';

/** Solo el administrador llega aquí: cambia el nombre y la imagen del grupo. */
export default function EditGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useGroup(id);
  const update = useUpdateGroup(group.data);

  if (group.isPending) return <LoadingView />;
  if (group.isError) return <ErrorView error={group.error} onRetry={group.refetch} />;

  return (
    <GroupForm
      group={group.data}
      submitTitle="Guardar cambios"
      saving={update.isPending}
      error={update.error}
      onSubmit={(input) => update.mutate(input, { onSuccess: () => router.back() })}
    />
  );
}

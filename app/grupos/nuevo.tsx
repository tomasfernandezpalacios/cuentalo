import { router } from 'expo-router';

import { GroupForm } from '@/features/social/components/GroupForm';
import { useCreateGroup } from '@/features/social/hooks';

export default function NewGroupScreen() {
  const create = useCreateGroup();

  return (
    <GroupForm
      submitTitle="Crear grupo"
      saving={create.isPending}
      error={create.error}
      onSubmit={(input) =>
        create.mutate(input, {
          onSuccess: (group) =>
            router.replace({ pathname: '/grupos/[id]', params: { id: group.id } }),
        })
      }
    />
  );
}

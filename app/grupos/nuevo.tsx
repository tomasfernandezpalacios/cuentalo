import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { useCreateGroup } from '@/features/social/hooks';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';
import { LIMITS, validateRequiredText } from '@/lib/validation';

export default function NewGroupScreen() {
  const colors = useThemeColors();
  const create = useCreateGroup();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const validation = validateRequiredText(name, 'El nombre', LIMITS.groupName);
    setError(validation);
    if (validation) return;
    create.mutate(name, {
      onSuccess: (group) => router.replace({ pathname: '/grupos/[id]', params: { id: group.id } }),
    });
  }

  return (
    <FormScreen>
      <TextField
        label="Nombre del grupo"
        value={name}
        onChangeText={setName}
        error={error}
        placeholder="ej. Los del gimnasio"
        maxLength={LIMITS.groupName}
        autoFocus
        onSubmitEditing={handleSubmit}
      />
      <Text style={{ color: colors.textMuted, fontFamily: fonts.detail }}>
        Serás el administrador: podrás invitar a tus amigos y gestionar el grupo.
      </Text>
      {create.error ? (
        <Text style={{ color: colors.danger, fontFamily: fonts.detail }}>
          {getErrorMessage(create.error)}
        </Text>
      ) : null}
      <AppButton title="Crear grupo" onPress={handleSubmit} loading={create.isPending} />
    </FormScreen>
  );
}

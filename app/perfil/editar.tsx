import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { FormScreen } from '@/components/FormScreen';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useUserId } from '@/features/auth/AuthProvider';
import { useProfile, useUpdateProfile, type Profile } from '@/features/perfil/api';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';
import { LIMITS, validateRequiredText, validateUsername } from '@/lib/validation';

export default function EditProfileScreen() {
  const profile = useProfile(useUserId());
  if (profile.isPending) return <LoadingView />;
  if (profile.isError) return <ErrorView error={profile.error} onRetry={profile.refetch} />;
  return <EditProfileForm profile={profile.data} />;
}

function EditProfileForm({ profile }: { profile: Profile }) {
  const colors = useThemeColors();
  const update = useUpdateProfile(profile);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [username, setUsername] = useState(profile.username);
  const [errors, setErrors] = useState<{ displayName?: string | null; username?: string | null }>(
    {},
  );

  function handleSubmit() {
    const next = {
      displayName: validateRequiredText(displayName, 'El nombre', LIMITS.displayName),
      username: validateUsername(username),
    };
    setErrors(next);
    if (next.displayName || next.username) return;
    update.mutate({ displayName, username }, { onSuccess: () => router.back() });
  }

  return (
    <FormScreen>
      <TextField
        label="Nombre"
        value={displayName}
        onChangeText={setDisplayName}
        error={errors.displayName}
        maxLength={LIMITS.displayName}
        autoComplete="name"
      />
      <TextField
        label="Nombre de usuario"
        value={username}
        onChangeText={setUsername}
        error={errors.username}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
      />
      <Text style={{ color: colors.textMuted, fontFamily: fonts.detail }}>
        Tus amigos te encuentran por tu nombre de usuario: letras minúsculas, números y guiones
        bajos.
      </Text>
      {update.error ? (
        <Text style={{ color: colors.danger, fontFamily: fonts.detail }}>
          {getErrorMessage(update.error)}
        </Text>
      ) : null}
      <AppButton title="Guardar" onPress={handleSubmit} loading={update.isPending} />
    </FormScreen>
  );
}

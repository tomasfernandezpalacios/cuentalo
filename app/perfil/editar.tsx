import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { EditablePhoto } from '@/components/EditablePhoto';
import { FormScreen } from '@/components/FormScreen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useUserId } from '@/features/auth/AuthProvider';
import { EmojiPicker } from '@/features/contadores/components/EmojiPicker';
import {
  useProfile,
  useProfilePhotoUrl,
  useUpdateProfile,
  type PickedPhoto,
  type Profile,
} from '@/features/perfil/api';
import { PersonAvatar } from '@/features/perfil/PersonAvatar';
import { getErrorMessage } from '@/lib/errors';
import { pickPhoto } from '@/lib/photos';
import { fonts, useThemeColors } from '@/lib/theme';
import { LIMITS, validateRequiredText, validateUsername } from '@/lib/validation';

type ImageMode = 'emoji' | 'photo';

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
  const [emoji, setEmoji] = useState(profile.emoji ?? '');
  const [mode, setMode] = useState<ImageMode>(profile.photo_path ? 'photo' : 'emoji');
  const [newPhoto, setNewPhoto] = useState<PickedPhoto | null>(null);
  const [errors, setErrors] = useState<{ displayName?: string | null; username?: string | null }>(
    {},
  );

  const hasPhoto = newPhoto !== null || (mode === 'photo' && Boolean(profile.photo_path));
  // Enlace de la foto guardada, para poder editarla.
  const savedPhoto = useProfilePhotoUrl(profile.photo_path);

  function removePhoto() {
    setNewPhoto(null);
    setMode('emoji');
  }

  function handleSubmit() {
    const next = {
      displayName: validateRequiredText(displayName, 'El nombre', LIMITS.displayName),
      username: validateUsername(username),
    };
    setErrors(next);
    if (next.displayName || next.username) return;
    const photo =
      mode === 'emoji' ? 'remove' : (newPhoto ?? (profile.photo_path ? 'keep' : 'remove'));
    update.mutate({ displayName, username, emoji, photo }, { onSuccess: () => router.back() });
  }

  return (
    <FormScreen>
      <View style={styles.preview}>
        <EditablePhoto
          hasPhoto={hasPhoto}
          editUri={newPhoto?.uri ?? (mode === 'photo' ? (savedPhoto.data ?? null) : null)}
          camera
          round
          onPicked={(photo) => {
            setNewPhoto(photo);
            setMode('photo');
          }}
          onRemove={removePhoto}
        >
          <PersonAvatar
            name={displayName || profile.display_name}
            emoji={emoji || null}
            photoPath={mode === 'photo' ? profile.photo_path : null}
            localUri={mode === 'photo' ? newPhoto?.uri : null}
            size={120}
          />
        </EditablePhoto>
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Imagen de perfil (opcional)</Text>
      <SegmentedControl
        options={[
          { value: 'emoji', label: 'Emoticono' },
          { value: 'photo', label: 'Foto' },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'emoji' ? (
        <>
          <EmojiPicker value={emoji} onChange={setEmoji} />
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Sin emoticono se muestra la inicial de tu nombre.
          </Text>
        </>
      ) : (
        <View style={styles.photoActions}>
          {hasPhoto ? null : (
            <AppButton
              title="Elegir de la galería"
              variant="secondary"
              onPress={() => pickPhoto('library').then((p) => p && setNewPhoto(p))}
            />
          )}
          {hasPhoto ? null : (
            <AppButton
              title="Hacer una foto"
              variant="secondary"
              onPress={() => pickPhoto('camera').then((p) => p && setNewPhoto(p))}
            />
          )}
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {hasPhoto ? 'Toca «Editar» sobre la foto para cambiarla, editarla o borrarla. ' : ''}
            Tu foto la ven las personas con cuenta en Cuéntalo, como tu nombre.
          </Text>
        </View>
      )}

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
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Tus amigos te encuentran por tu nombre de usuario: letras minúsculas, números y guiones
        bajos.
      </Text>
      {update.error ? (
        <Text style={[styles.hint, { color: colors.danger }]}>{getErrorMessage(update.error)}</Text>
      ) : null}
      <AppButton title="Guardar" onPress={handleSubmit} loading={update.isPending} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', marginTop: 8 },
  label: { fontSize: 15, fontFamily: fonts.detail },
  photoActions: { gap: 8 },
  hint: { fontSize: 14, fontFamily: fonts.detail },
});

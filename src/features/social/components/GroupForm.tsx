import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EditablePhoto } from '@/components/EditablePhoto';
import { AppButton } from '@/components/AppButton';
import { FormScreen } from '@/components/FormScreen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { EmojiPicker } from '@/features/contadores/components/EmojiPicker';
import { getErrorMessage } from '@/lib/errors';
import { pickPhoto } from '@/lib/photos';
import { fonts, useThemeColors } from '@/lib/theme';
import { LIMITS, validateRequiredText } from '@/lib/validation';

import type { Group, GroupInput, PickedPhoto } from '../api';

import { useGroupPhotoUrl } from '../hooks';

import { GroupAvatar } from './GroupAvatar';

type ImageMode = 'emoji' | 'photo';

type Props = {
  /** Grupo a editar; si no se pasa, se crea uno nuevo. */
  group?: Group;
  submitTitle: string;
  saving: boolean;
  error: unknown;
  onSubmit: (input: GroupInput) => void;
};

/** Nombre del grupo e imagen: un emoticono o una foto de la galería. */
export function GroupForm({ group, submitTitle, saving, error, onSubmit }: Props) {
  const colors = useThemeColors();
  const [name, setName] = useState(group?.name ?? '');
  const [emoji, setEmoji] = useState(group?.emoji ?? '');
  const [mode, setMode] = useState<ImageMode>(group?.photo_path ? 'photo' : 'emoji');
  const [newPhoto, setNewPhoto] = useState<PickedPhoto | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const hasPhoto = newPhoto !== null || (mode === 'photo' && Boolean(group?.photo_path));
  // Enlace de la foto guardada, para poder editarla.
  const savedPhoto = useGroupPhotoUrl(group?.photo_path ?? null);

  function removePhoto() {
    setNewPhoto(null);
    setMode('emoji');
  }

  function handleSubmit() {
    const error = validateRequiredText(name, 'El nombre', LIMITS.groupName);
    setNameError(error);
    if (error) return;
    const photo =
      mode === 'emoji' ? 'remove' : (newPhoto ?? (group?.photo_path ? 'keep' : 'remove'));
    onSubmit({ name, emoji, photo });
  }

  return (
    <FormScreen>
      <View style={styles.preview}>
        <EditablePhoto
          enabled={mode === 'photo'}
          hasPhoto={hasPhoto}
          editUri={newPhoto?.uri ?? (mode === 'photo' ? (savedPhoto.data ?? null) : null)}
          onPicked={(photo) => {
            setNewPhoto(photo);
            setMode('photo');
          }}
          onRemove={removePhoto}
        >
          <GroupAvatar
            emoji={emoji || null}
            photoPath={mode === 'photo' ? (group?.photo_path ?? null) : null}
            localUri={mode === 'photo' ? newPhoto?.uri : null}
            size={112}
          />
        </EditablePhoto>
      </View>

      <TextField
        label="Nombre del grupo"
        value={name}
        onChangeText={setName}
        error={nameError}
        placeholder="ej. Los del gimnasio"
        maxLength={LIMITS.groupName}
        autoFocus={!group}
      />

      <Text style={[styles.label, { color: colors.text }]}>Imagen del grupo (opcional)</Text>
      <SegmentedControl
        options={[
          { value: 'emoji', label: 'Emoticono' },
          { value: 'photo', label: 'Foto' },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'emoji' ? (
        <EmojiPicker value={emoji} onChange={setEmoji} />
      ) : (
        <View style={styles.photoActions}>
          {hasPhoto ? null : (
            <AppButton
              title="Elegir foto de la galería"
              variant="secondary"
              onPress={() => pickPhoto('library').then((p) => p && setNewPhoto(p))}
            />
          )}
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {hasPhoto ? 'Toca «Editar» sobre la foto para cambiarla, editarla o borrarla. ' : ''}
            La foto solo la ven los miembros del grupo.
          </Text>
        </View>
      )}

      {error ? (
        <Text style={[styles.hint, { color: colors.danger }]}>{getErrorMessage(error)}</Text>
      ) : null}
      <AppButton title={submitTitle} onPress={handleSubmit} loading={saving} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', marginTop: 8 },
  label: { fontSize: 15, fontFamily: fonts.detail },
  photoActions: { gap: 8 },
  hint: { fontSize: 14, fontFamily: fonts.detail },
});

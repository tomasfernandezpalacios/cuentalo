import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { PhotoEditor } from '@/components/PhotoEditor';
import { pickPhoto, type PickedPhoto } from '@/lib/photos';
import { fonts, useThemeColors } from '@/lib/theme';

type Props = {
  /** La imagen (avatar) sobre la que va el botón. */
  children: ReactNode;
  /** Hay foto (nueva o la guardada). */
  hasPhoto: boolean;
  /** Dirección de la foto actual para editarla (local o el enlace de la guardada). */
  editUri: string | null;
  /** Ofrecer también hacer una foto con la cámara. */
  camera?: boolean;
  /** Marco redondo en el editor (foto de perfil). */
  round?: boolean;
  onPicked: (photo: PickedPhoto) => void;
  onRemove: () => void;
};

/**
 * Imagen con un botón encima («Editar» o «Añadir foto») que abre las opciones: cambiar foto,
 * editar foto (mover, ampliar y girar) y borrar foto. Se usa al editar el perfil y el grupo.
 */
export function EditablePhoto({
  children,
  hasPhoto,
  editUri,
  camera = false,
  round = false,
  onPicked,
  onRemove,
}: Props) {
  const colors = useThemeColors();
  const [editing, setEditing] = useState<string | null>(null);

  async function choose(source: 'library' | 'camera') {
    const photo = await pickPhoto(source);
    if (photo) onPicked(photo);
  }

  function change() {
    if (!camera) {
      choose('library');
      return;
    }
    appAlert('Cambiar foto', undefined, [
      { text: 'Elegir de la galería', onPress: () => choose('library') },
      { text: 'Hacer una foto', onPress: () => choose('camera') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function openMenu() {
    if (!hasPhoto) {
      change();
      return;
    }
    appAlert(
      'Foto',
      undefined,
      [
        { text: 'Cambiar foto', onPress: change },
        ...(editUri ? [{ text: 'Editar foto', onPress: () => setEditing(editUri) }] : []),
        { text: 'Borrar foto', style: 'destructive' as const, onPress: onRemove },
        { text: 'Cancelar', style: 'cancel' as const },
      ],
      { warning: false },
    );
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel={hasPhoto ? 'Cambiar, editar o borrar la foto' : 'Añadir foto'}
      >
        {children}
      </Pressable>
      {/* El botón va encima de la parte de abajo de la imagen. */}
      <Pressable
        onPress={openMenu}
        importantForAccessibility="no"
        accessibilityElementsHidden
        hitSlop={8}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.primary,
            borderColor: colors.background,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons
          name={hasPhoto ? 'create-outline' : 'camera-outline'}
          size={16}
          color={colors.background}
        />
        <Text style={[styles.buttonText, { color: colors.background }]}>
          {hasPhoto ? 'Editar' : 'Añadir foto'}
        </Text>
      </Pressable>
      {editing ? (
        <PhotoEditor
          uri={editing}
          round={round}
          onCancel={() => setEditing(null)}
          onDone={(photo) => {
            setEditing(null);
            onPicked(photo);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingBottom: 14 },
  button: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
  },
  buttonText: { fontSize: 14, fontFamily: fonts.title },
});

import { Image, StyleSheet, Text, View } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

import { useAvatarOf, useProfilePhotoUrl } from './api';

type Props = {
  name: string;
  emoji: string | null;
  photoPath: string | null;
  /** Foto recién elegida (aún sin subir), para la vista previa del formulario. */
  localUri?: string | null;
  size?: number;
};

/** Imagen de una persona (círculo): su foto, si no su emoticono y si no su inicial. */
export function PersonAvatar({ name, emoji, photoPath, localUri, size = 44 }: Props) {
  const colors = useThemeColors();
  const photo = useProfilePhotoUrl(localUri ? null : photoPath);
  const uri = localUri ?? photo.data ?? null;
  const shape = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.tile, shape, { backgroundColor: colors.primarySoft }]}
    >
      {uri ? (
        <Image source={{ uri }} style={shape} />
      ) : emoji ? (
        <Text style={{ fontSize: size * 0.55 }} allowFontScaling={false}>
          {emoji}
        </Text>
      ) : (
        <Text
          allowFontScaling={false}
          style={{ fontSize: size * 0.45, fontFamily: fonts.title, color: colors.primary }}
        >
          {name.trim().charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

/** Igual, pero buscando la imagen por id (filas de clasificaciones, que solo traen el nombre). */
export function UserAvatar({
  userId,
  name,
  size,
}: {
  userId: string;
  name: string;
  size?: number;
}) {
  const avatar = useAvatarOf(userId);
  return (
    <PersonAvatar
      name={name}
      emoji={avatar.data?.emoji ?? null}
      photoPath={avatar.data?.photo_path ?? null}
      size={size}
    />
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

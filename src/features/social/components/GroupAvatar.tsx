import { Image, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/lib/theme';

import { useGroupPhotoUrl } from '../hooks';

type Props = {
  emoji: string | null;
  photoPath: string | null;
  /** Foto recién elegida (aún sin subir), para la vista previa del formulario. */
  localUri?: string | null;
  size?: number;
};

/** Imagen del grupo: su foto, si no su emoticono y si no 👥. */
export function GroupAvatar({ emoji, photoPath, localUri, size = 44 }: Props) {
  const colors = useThemeColors();
  const photo = useGroupPhotoUrl(localUri ? null : photoPath);
  const uri = localUri ?? photo.data ?? null;
  const shape = { width: size, height: size, borderRadius: size * 0.3 };

  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.tile, shape, { backgroundColor: colors.primarySoft }]}
    >
      {uri ? (
        <Image source={{ uri }} style={shape} />
      ) : (
        <Text style={{ fontSize: size * 0.55 }} allowFontScaling={false}>
          {emoji ?? '👥'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

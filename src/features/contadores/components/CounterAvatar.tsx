import { Image, StyleSheet, Text, View } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

import { useCounterPhotoUrl } from '../photos';

type Props = {
  emoji: string | null;
  name: string;
  /** Foto del contador (ruta en Storage), si tiene: va antes que el emoticono. */
  photoPath?: string | null;
  /** Foto recién elegida (aún sin subir), para la vista previa del formulario. */
  localUri?: string | null;
  size?: number;
};

/**
 * Icono del contador: su foto, si no su emoticono sobre un fondo suave y, si tampoco, la
 * inicial del nombre.
 */
export function CounterAvatar({
  emoji,
  name,
  photoPath = null,
  localUri = null,
  size = 44,
}: Props) {
  const colors = useThemeColors();
  const photo = useCounterPhotoUrl(localUri ? null : photoPath);
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

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

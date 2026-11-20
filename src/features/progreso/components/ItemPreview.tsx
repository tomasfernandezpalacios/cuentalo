import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { MascotFace } from '@/features/mascota/MascotFace';
import { useThemeColors } from '@/lib/theme';

import { Accessories } from '../Accessories';
import type { ShopItem } from '../shop';
import { Scene } from './Scene';

/** Zona de la miniatura de cada accesorio: la bola y lo que sobresale por arriba y abajo. */
const TILE_VIEW = { left: -1.3, top: -2.05, width: 2.6, height: 3.5 };

/**
 * Miniatura de una cosa de la tienda: la mascota con el accesorio, el fondo o el icono de la
 * animación. `size` es el ancho de la de un fondo (las demás, algo más de la mitad).
 */
export function ItemPreview({ item, size = 88 }: { item: ShopItem; size?: number }) {
  const colors = useThemeColors();
  const small = Math.round(size * 0.6);
  if (item.kind === 'accesorio') {
    return (
      <MascotFace size={small} viewBox={TILE_VIEW}>
        <Accessories ids={[item.id]} />
      </MascotFace>
    );
  }
  if (item.kind === 'fondo') {
    return (
      <View style={styles.scene}>
        <Scene id={item.id} width={size} height={Math.round(size * 0.6)} />
      </View>
    );
  }
  return (
    <View
      style={[
        styles.anim,
        { width: small, height: small, borderRadius: small / 2, backgroundColor: colors.elevated },
      ]}
    >
      <Ionicons name="play" size={Math.round(small * 0.45)} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { borderRadius: 10, overflow: 'hidden' },
  anim: { alignItems: 'center', justifyContent: 'center' },
});

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_HEIGHT } from './tabBar';

/**
 * Hueco que hay que dejar al final de las listas de las pestañas: la barra va encima del contenido
 * (lo de detrás se ve junto a sus esquinas redondeadas) y, sin él, lo último quedaría tapado.
 */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR_HEIGHT + 24; // también lo que sobresale la bola
}

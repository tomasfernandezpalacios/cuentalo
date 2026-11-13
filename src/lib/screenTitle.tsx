import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { screenTitleFont } from './theme';

// Tamaño de los títulos de cabecera en el estilo Cine («Mis contadores», «Estadísticas»…).
//
// Todos tienen el mismo tamaño, y lo marca el más apretado: «Mis contadores», que comparte la
// cabecera con la racha y con tres botones (fusionar, filtros y +). Se mide lo que ocupa el
// texto a tamaño 100 y lo que ocupa la racha, y se elige el mayor tamaño que cabe sin que se
// solapen (como mucho MAX_SIZE).

const MAX_SIZE = 30;
const MIN_SIZE = 20;
const REFERENCE = 100;
/**
 * Ancho de los botones de la derecha de «Contadores». Se deja como cuando había tres botones
 * (también fusionar): el usuario quiere el tamaño de títulos de entonces.
 */
export const HEADER_RIGHT_WIDTH = 139;
/** Hueco entre el título y la racha. */
export const TITLE_GAP = 12;
/** Margen izquierdo de la cabecera, hueco entre título y racha y un poco de aire. */
const HEADER_SPACING = 16 + TITLE_GAP + 16;

let textWidthAtReference = 0;
let badgeWidth = 72;
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** El tamaño que cabe en una pantalla de este ancho (función pura, con tests). */
export function fitTitleSize(
  screenWidth: number,
  textWidthAt100: number,
  badge: number,
  rightWidth = HEADER_RIGHT_WIDTH,
): number {
  if (textWidthAt100 <= 0) return MAX_SIZE - 2;
  const available = screenWidth - rightWidth - HEADER_SPACING - badge;
  const size = Math.floor((available / textWidthAt100) * REFERENCE);
  return Math.max(MIN_SIZE, Math.min(MAX_SIZE, size));
}

/** Tamaño de los títulos de cabecera (se recalcula al medir el texto o la racha). */
export function useScreenTitleSize(): number {
  useSyncExternalStore(subscribe, () => version);
  const { width } = useWindowDimensions();
  return fitTitleSize(width, textWidthAtReference, badgeWidth);
}

/** La racha de «Mis contadores» avisa de lo que ocupa (cambia con las cifras). */
export function reportBadgeWidth(width: number) {
  const rounded = Math.ceil(width);
  if (rounded === badgeWidth) return;
  badgeWidth = rounded;
  emit();
}

/** Texto invisible que mide «Mis contadores» a tamaño 100 (montado una vez en la raíz). */
export function TitleMeasurer() {
  return (
    <View style={styles.hidden} pointerEvents="none" accessibilityElementsHidden>
      <Text
        // A tamaño 100 exacto (sin el ajuste de cada tipografía): el título se dibuja igual.
        style={{ ...screenTitleFont(REFERENCE) }}
        numberOfLines={1}
        onLayout={(e) => {
          const width = Math.ceil(e.nativeEvent.layout.width);
          if (width === textWidthAtReference) return;
          textWidthAtReference = width;
          emit();
        }}
      >
        {/* Se sigue midiendo con «Mis contadores» aunque la pestaña se llame «Contadores»: el
            usuario prefiere el tamaño de títulos que salía así. */}
        Mis contadores
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    left: -10000,
    top: 0,
    opacity: 0,
    width: 2000,
    alignItems: 'flex-start',
  },
});

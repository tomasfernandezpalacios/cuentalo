import type { ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useScreenTitleSize } from '@/lib/screenTitle';
import { screenTitleFont, useThemeColors } from '@/lib/theme';

/** Sitio que se deja a la izquierda (flecha de volver) y a la derecha (botones de la cabecera). */
const LEFT_RESERVE = 72;
const RIGHT_RESERVE = 110;

/**
 * Título de cabecera de las pantallas que se abren encima (estilo Cine). Mismo tamaño que el de
 * las pestañas, pero nunca más ancho que el hueco entre la flecha y los botones: si el nombre es
 * largo (un contador, un grupo, una persona), la letra se reduce hasta caber y, si aun así no
 * cabe, se corta con «…». Así nunca se solapa con los botones de la derecha.
 */
export function HeaderTitle({ children, badge }: { children: string; badge?: ReactNode }) {
  const colors = useThemeColors();
  const size = useScreenTitleSize();
  const { width } = useWindowDimensions();
  const maxWidth = width - LEFT_RESERVE - RIGHT_RESERVE;
  if (badge) {
    // Con algo a la derecha del nombre (la racha de un contador): el nombre se reduce o corta
    // antes que eso, y los dos juntos caben en el mismo hueco.
    return (
      <View style={[styles.row, { maxWidth }]}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
          accessibilityRole="header"
          style={[screenTitleFont(size), styles.shrink, { color: colors.text }]}
        >
          {children}
        </Text>
        {badge}
      </View>
    );
  }
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.65}
      accessibilityRole="header"
      style={[screenTitleFont(size), { color: colors.text, maxWidth }]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shrink: { flexShrink: 1 },
});

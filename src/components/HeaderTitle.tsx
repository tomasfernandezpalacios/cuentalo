import { Text, useWindowDimensions } from 'react-native';

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
export function HeaderTitle({ children }: { children: string }) {
  const colors = useThemeColors();
  const size = useScreenTitleSize();
  const { width } = useWindowDimensions();
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.65}
      accessibilityRole="header"
      style={[
        screenTitleFont(size),
        { color: colors.text, maxWidth: width - LEFT_RESERVE - RIGHT_RESERVE },
      ]}
    >
      {children}
    </Text>
  );
}

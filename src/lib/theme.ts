import { Appearance, useColorScheme } from 'react-native';

import { type AccentName, getSettings, useSettings } from '@/features/configuracion/settings';
import { withAlpha } from '@/lib/color';

const palette = {
  light: {
    background: '#F7F7FA',
    surface: '#FFFFFF',
    text: '#14141A',
    textMuted: '#6B6B78',
    border: '#E4E4EC',
    elevated: '#FFFFFF',
    primary: '#5B4BDB',
    primarySoft: '#ECE9FC',
    flame: '#F2711C',
    onPrimary: '#FFFFFF',
    danger: '#D93A3A',
  },
  dark: {
    background: '#0E0E12',
    surface: '#1A1A21',
    text: '#F2F2F5',
    textMuted: '#9A9AA8',
    border: '#2A2A33',
    elevated: '#1A1A21',
    primary: '#8B7DFF',
    primarySoft: '#262240',
    flame: '#FF8A3D',
    onPrimary: '#0E0E12',
    danger: '#FF6B6B',
  },
};

/**
 * Estilo de la app: «Cine» (decisión del usuario, es el único). Cálido y editorial: serif para
 * títulos y cifras, Redaction 10 para el resto, tarjetas muy redondeadas, botones en píldora.
 * Claro u oscuro y con el color de destaque que se elija (dorado de serie).
 *
 * El estilo anterior («clásico», morado) sigue en las ramas `isCinema ? … : …` por si hiciera
 * falta volver, y entero en las etiquetas de Git `diseno-clasico` (antes de Cine) y
 * `estilos-elegibles` (con los dos estilos elegibles en Configuración).
 */
export const isCinema = true;

/**
 * Paletas de Cine. Oscuro: «cuaderno de noche con luz de lámpara» (negro cálido, blanco hueso).
 * Claro: papel cálido (nunca blanco puro) con tinta casi negra. El color de destaque se añade
 * encima (accents).
 */
const cinemaPalette = {
  light: {
    background: '#F3EEE4',
    surface: '#FBF8F2',
    elevated: '#E9E2D4',
    text: '#1A1714',
    textMuted: '#6B655B',
    border: 'rgba(26,23,20,0.10)',
    primary: '#7E611B',
    primarySoft: '#EFE3C6',
    flame: '#C2551F',
    onPrimary: '#FFFFFF',
    danger: '#C62828',
  },
  dark: {
    background: '#0B0A09',
    surface: '#141311',
    elevated: '#1C1A17',
    text: '#F5F1E8',
    textMuted: '#A8A196',
    border: 'rgba(255,255,255,0.08)',
    primary: '#E9C46A',
    primarySoft: '#2A2418',
    flame: '#E58A55',
    onPrimary: '#0B0A09',
    danger: '#EF4444',
  },
};

/**
 * Modo con el que arrancó la app. Lo usan los estilos fijos (StyleSheet) que dependen del modo,
 * como el engrosado de la serif; por eso cambiar el tema ofrece reiniciar la app.
 */
const startMode: 'light' | 'dark' = (() => {
  const { theme } = getSettings();
  if (theme !== 'system') return theme;
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
})();

/**
 * Tipografías (cargadas en app/_layout.tsx). Con fuentes personalizadas no se usa
 * fontWeight: cada archivo ya es un peso concreto.
 * - title: títulos, nombres, cifras y botones (clásico: Ubuntu Bold; cine: Redaction 10 Bold).
 * - detail: detalles y textos secundarios (clásico: Redaction; cine: Redaction 10).
 * - display: títulos de pantalla y cifras grandes (clásico: Ubuntu Bold; cine: Instrument
 *   Serif, el toque editorial).
 * - prose: explicaciones largas y avisos (clásico: Redaction; cine: Instrument Serif itálica).
 */
export const fonts = isCinema
  ? ({
      title: 'Redaction10-Bold',
      detail: 'Redaction10-Regular',
      display: 'InstrumentSerif_400Regular',
      prose: 'InstrumentSerif_400Regular_Italic',
    } as const)
  : ({
      title: 'Ubuntu-Bold',
      detail: 'Redaction-Regular',
      display: 'Ubuntu-Bold',
      prose: 'Redaction-Regular',
    } as const);

/**
 * Colores de un chip (carpetas, opciones, periodos…). Clásico: el activo en el color de la app.
 * Cine: píldoras oscuras y la activa en dorado suave (fondo dorado oscuro, borde y texto dorados).
 */
export function chipColors(colors: ThemeColors, selected: boolean) {
  if (isCinema) {
    return selected
      ? { backgroundColor: colors.primarySoft, borderColor: colors.primary, color: colors.primary }
      : { backgroundColor: colors.elevated, borderColor: 'transparent', color: colors.text };
  }
  return selected
    ? { backgroundColor: colors.primary, borderColor: colors.primary, color: colors.onPrimary }
    : { backgroundColor: colors.background, borderColor: colors.border, color: colors.text };
}

/**
 * Tipografía de los títulos (de pantalla, de sección, de avisos…). En Cine, la serif editorial;
 * como su letra es más pequeña a igual tamaño, se agranda un 30 %.
 */
export function titleFont(size: number) {
  return {
    fontFamily: fonts.display,
    fontSize: isCinema ? Math.round(size * 1.3) : size,
    ...serifWeight(),
  };
}

/** Cifras grandes y títulos destacados con la letra de `display` (en Cine, un poco más gruesa). */
export function displayFont(size: number) {
  return { fontFamily: fonts.display, fontSize: size, ...serifWeight() };
}

/**
 * Instrument Serif solo existe en un grosor: para que se vea un poco más gruesa (petición del
 * usuario) se dibuja una sombra nítida del mismo color desplazada medio punto. `color` es el del
 * texto (por defecto, el blanco hueso de Cine; si el texto es dorado, se pasa el dorado).
 */
export function serifWeight(color: string = cinemaPalette[startMode].text) {
  if (!isCinema) return {};
  return {
    textShadowColor: color,
    textShadowOffset: { width: 0.6, height: 0 },
    textShadowRadius: 0.6,
  };
}

/**
 * Tipografía de las explicaciones largas y de los avisos. En Cine, la serif de los títulos en
 * itálica, un 20 % más grande (su letra es pequeña).
 */
export function proseFont(size: number, lineHeight?: number) {
  const k = isCinema ? 1.2 : 1;
  return {
    fontFamily: fonts.prose,
    fontSize: Math.round(size * k),
    ...(lineHeight ? { lineHeight: Math.round(lineHeight * k) } : {}),
  };
}

/**
 * Recuadros que destacan sobre la pantalla (aviso de deshacer, dato de la gráfica, mensajes del
 * tutorial). Clásico: invertidos (fondo del color del texto). Cine: nada de bloques blancos, un
 * escalón más claro que las tarjetas con borde dorado suave.
 */
export function inverseColors(colors: ThemeColors) {
  return isCinema
    ? {
        backgroundColor: colors.elevated,
        borderColor: withAlpha(colors.primary, 0.35),
        color: colors.text,
      }
    : { backgroundColor: colors.text, borderColor: colors.text, color: colors.background };
}

/**
 * Título de cabecera de cada pantalla («Mis contadores», «Estadísticas»…): el mismo tamaño en
 * todas. En Cine, grande y en la serif; en clásico, como siempre (la cabecera de «Mis contadores»
 * es propia y usa 18).
 */
export function screenTitleFont(size = 30) {
  return isCinema
    ? { fontFamily: fonts.display, fontSize: size, ...serifWeight() }
    : { fontFamily: fonts.title, fontSize: 18 };
}

/**
 * Cabeceras de las pantallas. Cine: sin franja ni sombra (se funden con el fondo) y el título en
 * la serif editorial; clásico: la franja de siempre.
 */
export function headerOptions(colors: ThemeColors, titleSize?: number) {
  return isCinema
    ? {
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: screenTitleFont(titleSize),
      }
    : {
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.title },
      };
}

/**
 * Formas: en el estilo Cine, tarjetas muy redondeadas y botones y chips en píldora.
 */
export const shape = isCinema
  ? { card: 24, button: 999, chip: 999 }
  : { card: 16, button: 12, chip: 18 };

export type ThemeColors = typeof palette.light;

type AccentColors = Pick<ThemeColors, 'primary' | 'primarySoft'>;

/**
 * Colores de destaque de Configuración: seis clásicos y sobrios (el dorado es el de serie). Todos
 * tienen un contraste de al menos 4,5:1 con el texto de los botones (AA) en su modo.
 */
export const accents: Record<
  AccentName,
  { label: string; light: AccentColors; dark: AccentColors }
> = {
  dorado: {
    label: 'Dorado',
    light: { primary: cinemaPalette.light.primary, primarySoft: cinemaPalette.light.primarySoft },
    dark: { primary: cinemaPalette.dark.primary, primarySoft: cinemaPalette.dark.primarySoft },
  },
  burdeos: {
    label: 'Burdeos',
    light: { primary: '#7A2333', primarySoft: '#F0DEDF' },
    dark: { primary: '#D27A86', primarySoft: '#2E1A1D' },
  },
  verde: {
    label: 'Verde inglés',
    light: { primary: '#2F5D46', primarySoft: '#DDE8DF' },
    dark: { primary: '#8DBF9E', primarySoft: '#18261D' },
  },
  azul: {
    label: 'Azul tinta',
    light: { primary: '#2C4A72', primarySoft: '#DCE3EE' },
    dark: { primary: '#8FAFD6', primarySoft: '#17202D' },
  },
  terracota: {
    label: 'Terracota',
    light: { primary: '#9E452B', primarySoft: '#F3E0D7' },
    dark: { primary: '#E0896A', primarySoft: '#2D1B14' },
  },
  plata: {
    label: 'Plata',
    light: { primary: '#55565A', primarySoft: '#E3E2DE' },
    dark: { primary: '#C8C6C0', primarySoft: '#232220' },
  },
};

/** 'light' o 'dark' según el ajuste de tema (o el del sistema si es automático). */
export function useColorMode(): 'light' | 'dark' {
  const system = useColorScheme();
  const { theme } = useSettings();
  if (theme !== 'system') return theme;
  return system === 'dark' ? 'dark' : 'light';
}

export function useThemeColors(): ThemeColors {
  const mode = useColorMode();
  const { accent } = useSettings();
  const chosen = accents[accent] ?? accents.dorado;
  const base = isCinema ? cinemaPalette : palette;
  return { ...base[mode], ...chosen[mode] };
}

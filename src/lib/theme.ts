import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { type AccentName, getSettings, useSettings } from '@/features/configuracion/settings';
import { customAccent, normalizeHex } from '@/lib/color';

const palette = {
  light: {
    background: '#F7F7FA',
    surface: '#FFFFFF',
    text: '#14141A',
    textMuted: '#6B6B78',
    border: '#E4E4EC',
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
    primary: '#8B7DFF',
    primarySoft: '#262240',
    flame: '#FF8A3D',
    onPrimary: '#0E0E12',
    danger: '#FF6B6B',
  },
};

/**
 * Estilo visual (Configuración → Apariencia). Se lee una vez al arrancar: las tipografías y
 * formas de cada pantalla se fijan al cargar, así que cambiarlo reinicia la app.
 * - 'clasico': el morado de siempre, claro u oscuro.
 * - 'cine' (prueba): «cuaderno de estudio de noche con luz de lámpara». Oscuro cálido, un solo
 *   acento dorado, serif editorial para títulos y cifras y sans neutra para la interfaz.
 */
export const isCinema = getSettings().visualStyle === 'cine';

/** Paleta del estilo Cine (siempre oscura). Texto sobre el dorado, siempre casi negro. */
const cinemaPalette = {
  background: '#0B0A09',
  surface: '#141311',
  text: '#F5F1E8',
  textMuted: '#A8A196',
  border: 'rgba(255,255,255,0.08)',
  primary: '#E9C46A',
  primarySoft: '#2A2418',
  flame: '#E58A55',
  onPrimary: '#0B0A09',
  danger: '#EF4444',
};

/**
 * Tipografías (cargadas en app/_layout.tsx). Con fuentes personalizadas no se usa
 * fontWeight: cada archivo ya es un peso concreto.
 * - title: títulos, nombres, cifras y botones (clásico: Ubuntu Bold; cine: Inter SemiBold).
 * - detail: detalles y textos secundarios (clásico: Redaction; cine: Inter Regular).
 * - display: títulos de pantalla y cifras grandes (clásico: Ubuntu Bold; cine: Instrument
 *   Serif, el toque editorial).
 */
export const fonts = isCinema
  ? ({
      title: 'Inter_600SemiBold',
      detail: 'Inter_400Regular',
      display: 'InstrumentSerif_400Regular',
    } as const)
  : ({ title: 'Ubuntu-Bold', detail: 'Redaction-Regular', display: 'Ubuntu-Bold' } as const);

/** Fondo de chips, campos y tarjetas anidadas en el estilo Cine (un escalón sobre las tarjetas). */
export const CINEMA_ELEVATED_2 = '#1C1A17';

/**
 * Colores de un chip (carpetas, opciones, periodos…). Clásico: el activo en el color de la app.
 * Cine: píldoras oscuras y la activa en blanco hueso con texto casi negro.
 */
export function chipColors(colors: ThemeColors, selected: boolean) {
  if (isCinema) {
    return selected
      ? { backgroundColor: colors.text, borderColor: colors.text, color: colors.background }
      : { backgroundColor: CINEMA_ELEVATED_2, borderColor: 'transparent', color: colors.text };
  }
  return selected
    ? { backgroundColor: colors.primary, borderColor: colors.primary, color: colors.onPrimary }
    : { backgroundColor: colors.background, borderColor: colors.border, color: colors.text };
}

/**
 * Cabeceras de las pantallas. Cine: sin franja ni sombra (se funden con el fondo) y el título en
 * la serif editorial; clásico: la franja de siempre.
 */
export function headerOptions(colors: ThemeColors) {
  return isCinema
    ? {
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 26 },
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
 * Colores de acento que se pueden elegir en Configuración (el morado es el de serie). Todos
 * tienen un contraste de al menos 4,5:1 con el texto de los botones (AA) en su modo.
 */
export const accents: Record<
  AccentName,
  { label: string; light: AccentColors; dark: AccentColors }
> = {
  morado: {
    label: 'Morado',
    light: { primary: '#5B4BDB', primarySoft: '#ECE9FC' },
    dark: { primary: '#8B7DFF', primarySoft: '#262240' },
  },
  azul: {
    label: 'Azul',
    light: { primary: '#1F6FD1', primarySoft: '#E3EEFC' },
    dark: { primary: '#6EA8FF', primarySoft: '#1B2840' },
  },
  verde: {
    label: 'Verde',
    light: { primary: '#13804B', primarySoft: '#E1F3E9' },
    dark: { primary: '#4CC38A', primarySoft: '#17301F' },
  },
  naranja: {
    label: 'Naranja',
    light: { primary: '#B8500A', primarySoft: '#FCEADB' },
    dark: { primary: '#FF9A4D', primarySoft: '#3A2414' },
  },
  rosa: {
    label: 'Rosa',
    light: { primary: '#C2185B', primarySoft: '#FBE3EC' },
    dark: { primary: '#FF7AA8', primarySoft: '#3A1A28' },
  },
};

/** 'light' o 'dark' según el ajuste de tema (o el del sistema si es automático). */
export function useColorMode(): 'light' | 'dark' {
  const system = useColorScheme();
  const { theme } = useSettings();
  // El estilo Cine es oscuro siempre (es su identidad).
  if (isCinema) return 'dark';
  if (theme !== 'system') return theme;
  return system === 'dark' ? 'dark' : 'light';
}

/** Colores de los dos modos para un color elegido a mano (con contraste AA en los botones). */
export function customAccentColors(hex: string) {
  return customAccent(normalizeHex(hex) ?? accents.morado.light.primary, {
    lightBackground: palette.light.background,
    darkBackground: palette.dark.background,
    lightOnPrimary: palette.light.onPrimary,
    darkOnPrimary: palette.dark.onPrimary,
  });
}

export function useThemeColors(): ThemeColors {
  const mode = useColorMode();
  const { accent, customAccent: custom } = useSettings();
  const customColors = useMemo(() => customAccentColors(custom), [custom]);
  const chosen = accent === 'custom' ? customColors : (accents[accent] ?? accents.morado);
  if (isCinema) return cinemaPalette;
  return { ...palette[mode], ...chosen[mode] };
}

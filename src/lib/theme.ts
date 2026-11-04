import { useColorScheme } from 'react-native';

import { type AccentName, useSettings } from '@/features/configuracion/settings';

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
 * Tipografías (cargadas en app/_layout.tsx):
 * - title: Ubuntu Bold, para títulos, nombres, cifras y botones.
 * - detail: Redaction, para detalles y textos secundarios.
 * Con fuentes personalizadas no se usa fontWeight: cada archivo ya es un peso concreto.
 */
export const fonts = {
  title: 'Ubuntu-Bold',
  detail: 'Redaction-Regular',
} as const;

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
  if (theme !== 'system') return theme;
  return system === 'dark' ? 'dark' : 'light';
}

export function useThemeColors(): ThemeColors {
  const mode = useColorMode();
  const { accent } = useSettings();
  return { ...palette[mode], ...(accents[accent] ?? accents.morado)[mode] };
}

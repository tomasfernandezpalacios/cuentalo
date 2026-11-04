import { useColorScheme } from 'react-native';

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

export function useThemeColors(): ThemeColors {
  return useColorScheme() === 'dark' ? palette.dark : palette.light;
}

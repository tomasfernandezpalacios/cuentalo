import { useColorScheme } from 'react-native';

// Paleta cálida (petición del usuario): que la app transmita calma y hogar, no obligación.
// Fondo de cada página crema #FFEDA1, tarjetas en un crema más claro, texto marrón #2E190B y
// verde #009146 como color principal. De momento es igual en modo claro y oscuro.
// Diseños anteriores en Git: etiqueta `diseno-morado`, commits 71f637e (crema, texto #3D1813)
// y 05ed122 (fondo marrón).
const warm = {
  background: '#FFEDA1',
  surface: '#FFF7D6',
  text: '#2E190B',
  textMuted: '#6B4A31',
  border: '#E9D48C',
  primary: '#009146',
  primarySoft: '#DDEFC4',
  flame: '#E8650F',
  onPrimary: '#FFFFFF',
  danger: '#C62828',
  /** Iconos de la barra de estado (hora, batería): oscuros sobre el fondo claro. */
  statusBar: 'dark' as 'light' | 'dark',
};

const palette = {
  light: warm,
  dark: warm,
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

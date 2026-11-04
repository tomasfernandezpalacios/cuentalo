import { useColorScheme } from 'react-native';

// Paleta cálida (petición del usuario): que la app transmita calma y hogar, no obligación.
// Ahora en versión invertida: fondo marrón oscuro #2E190B, texto crema #FFEDA1 y verde
// #009146 como color principal. De momento es igual en modo claro y oscuro.
// Diseños anteriores en Git: etiqueta `diseno-morado` (morado) y commit 71f637e (crema).
const warm = {
  background: '#2E190B',
  surface: '#3E2414',
  text: '#FFEDA1',
  textMuted: '#D8C38B',
  border: '#5A3A22',
  primary: '#009146',
  primarySoft: '#1F3B26',
  flame: '#FF8A3D',
  onPrimary: '#FFFFFF',
  danger: '#FF7B6B',
  /** Iconos de la barra de estado (hora, batería): claros sobre fondo oscuro. */
  statusBar: 'light' as 'light' | 'dark',
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

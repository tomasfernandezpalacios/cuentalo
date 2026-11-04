import { useColorScheme } from 'react-native';

// Paleta cálida (petición del usuario): que la app transmita calma y hogar, no obligación.
// Claro: fondo crema, texto marrón y verde como color principal. Oscuro: la misma idea en
// marrones oscuros, con el crema como texto y un verde más claro para que contraste.
// El diseño anterior (morado) está guardado en la etiqueta de Git `diseno-morado`.
const palette = {
  light: {
    background: '#FFEDA1',
    surface: '#FFF7D6',
    text: '#3D1813',
    textMuted: '#73503E',
    border: '#E9D48C',
    primary: '#009146',
    primarySoft: '#DDEFC4',
    flame: '#E8650F',
    onPrimary: '#FFFFFF',
    danger: '#C62828',
  },
  dark: {
    background: '#1F1611',
    surface: '#2C201A',
    text: '#FFEDA1',
    textMuted: '#D1BB9C',
    border: '#3F2F26',
    primary: '#3DBE7A',
    primarySoft: '#1D3A2A',
    flame: '#FF8A3D',
    onPrimary: '#1F1611',
    danger: '#FF7B6B',
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

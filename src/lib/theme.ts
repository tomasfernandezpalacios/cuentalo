import { useColorScheme } from 'react-native';

const palette = {
  light: {
    background: '#F7F7FA',
    surface: '#FFFFFF',
    text: '#14141A',
    textMuted: '#6B6B78',
    border: '#E4E4EC',
    primary: '#5B4BDB',
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
    onPrimary: '#0E0E12',
    danger: '#FF6B6B',
  },
};

export type ThemeColors = typeof palette.light;

export function useThemeColors(): ThemeColors {
  return useColorScheme() === 'dark' ? palette.dark : palette.light;
}

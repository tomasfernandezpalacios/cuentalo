import { Fraunces_400Regular_Italic, Fraunces_800ExtraBold } from '@expo-google-fonts/fraunces';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import type { FontSource } from 'expo-font';

import { typography } from './typography';

/** Las cuatro letras de la tipografía de la app, listas para `useFonts`. */
export const appFonts: Record<string, FontSource> = {
  Fraunces_800ExtraBold,
  Fraunces_400Regular_Italic,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_700Bold,
};

// Seguridad: las cuatro letras de `typography.fonts` deben estar cargadas.
for (const name of Object.values(typography.fonts)) {
  if (!appFonts[name]) throw new Error(`Falta cargar la letra ${name}`);
}

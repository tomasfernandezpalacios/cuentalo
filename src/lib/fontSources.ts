import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import {
  DMSerifDisplay_400Regular,
  DMSerifDisplay_400Regular_Italic,
} from '@expo-google-fonts/dm-serif-display';
import { Fraunces_400Regular_Italic, Fraunces_800ExtraBold } from '@expo-google-fonts/fraunces';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import { Newsreader_400Regular, Newsreader_400Regular_Italic } from '@expo-google-fonts/newsreader';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import type { FontSource } from 'expo-font';

import type { Typography } from './typography';

// Dónde está cada letra de las tipografías de src/lib/typography.ts, por su nombre.
const SOURCES: Record<string, FontSource> = {
  Fraunces_800ExtraBold,
  Fraunces_400Regular_Italic,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_700Bold,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  DMSerifDisplay_400Regular,
  DMSerifDisplay_400Regular_Italic,
  DMSans_400Regular,
  DMSans_700Bold,
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
  'Redaction10-Regular': require('../../assets/fonts/Redaction10-Regular.otf'),
  'Redaction10-Bold': require('../../assets/fonts/Redaction10-Bold.otf'),
};

/**
 * Las letras de las tipografías dadas, listas para `useFonts`. Al arrancar solo se cargan las
 * cuatro de la tipografía elegida (antes se cargaban 21 y la pantalla de carga esperaba a todas).
 */
export function fontsFor(...typographies: Typography[]): Record<string, FontSource> {
  const fonts: Record<string, FontSource> = {};
  for (const typography of typographies) {
    for (const name of Object.values(typography.fonts)) {
      const source = SOURCES[name];
      if (source) fonts[name] = source;
    }
  }
  return fonts;
}

// Combinaciones de tipografías de prueba (petición del usuario: «modernas, cercanas y
// atractivas, que cuenten historias; títulos llamativos y elegantes, y el resto que encaje pero
// contraste»). Todas de Google Fonts (@expo-google-fonts), funcionan en Expo Go.
//
// Cada una reparte los mismos cuatro papeles de siempre:
//  - display: títulos de pantalla y cifras grandes (lo llamativo).
//  - title:   nombres, botones, pestañas (la letra «de interfaz», con peso).
//  - detail:  textos secundarios (fechas, unidades, descripciones).
//  - prose:   explicaciones largas y avisos (en cursiva, como hasta ahora).
// `displayFactor` corrige el tamaño respecto a Instrument Serif (que es pequeña a igual tamaño,
// por eso los tamaños de la app están pensados para ella); `proseScale` igual para la cursiva.

export type TypographyName = 'editorial' | 'caracter' | 'clasica' | 'actual';

export type Typography = {
  label: string;
  /** Qué es, en pocas palabras (Configuración). */
  description: string;
  fonts: { display: string; title: string; detail: string; prose: string };
  /** Interletrado de los títulos grandes (las letras muy gruesas piden ir un poco más juntas). */
  displayLetterSpacing?: number;
  displayFactor: number;
  proseScale: number;
  /** Engordar la serif con una sombra (solo Instrument Serif, que tiene un único grosor). */
  fakeBold: boolean;
};

export const TYPOGRAPHIES: Record<TypographyName, Typography> = {
  editorial: {
    label: 'Editorial',
    description: 'Fraunces y Plus Jakarta Sans',
    fonts: {
      // ExtraBold: más grueso y con más vida (petición del usuario); Fraunces luce sus curvas
      // «blandas» en los pesos altos.
      display: 'Fraunces_800ExtraBold',
      title: 'PlusJakartaSans_700Bold',
      detail: 'PlusJakartaSans_400Regular',
      prose: 'Fraunces_400Regular_Italic',
    },
    displayFactor: 0.8,
    displayLetterSpacing: -0.4,
    proseScale: 1,
    fakeBold: false,
  },
  caracter: {
    label: 'Con carácter',
    description: 'Bricolage Grotesque y Newsreader',
    fonts: {
      display: 'BricolageGrotesque_700Bold',
      title: 'BricolageGrotesque_600SemiBold',
      detail: 'Newsreader_400Regular',
      prose: 'Newsreader_400Regular_Italic',
    },
    displayFactor: 0.78,
    proseScale: 1.08,
    fakeBold: false,
  },
  clasica: {
    label: 'Clásica',
    description: 'DM Serif Display y DM Sans',
    fonts: {
      display: 'DMSerifDisplay_400Regular',
      title: 'DMSans_700Bold',
      detail: 'DMSans_400Regular',
      prose: 'DMSerifDisplay_400Regular_Italic',
    },
    displayFactor: 0.86,
    proseScale: 1.05,
    fakeBold: false,
  },
  actual: {
    label: 'La de ahora',
    description: 'Instrument Serif y Redaction 10',
    fonts: {
      display: 'InstrumentSerif_400Regular',
      title: 'Redaction10-Bold',
      detail: 'Redaction10-Regular',
      prose: 'InstrumentSerif_400Regular_Italic',
    },
    displayFactor: 1,
    proseScale: 1.2,
    fakeBold: true,
  },
};

export const TYPOGRAPHY_NAMES = Object.keys(TYPOGRAPHIES) as TypographyName[];

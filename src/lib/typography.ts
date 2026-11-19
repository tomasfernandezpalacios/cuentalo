// Tipografías definitivas de la app (decisión del usuario; las demás pruebas están en la etiqueta
// de Git `opciones-apariencia`). Todas de Google Fonts (@expo-google-fonts), funcionan en Expo Go.
//
// Cuatro papeles:
//  - display: títulos de pantalla y cifras grandes (Fraunces ExtraBold, llamativa y con vida).
//  - title:   nombres, botones, pestañas (Plus Jakarta Sans Bold).
//  - detail:  textos secundarios (fechas, unidades, descripciones).
//  - prose:   explicaciones largas y avisos, en cursiva.
// `displayFactor` y `proseScale` ajustan los tamaños, pensados para una serif más pequeña.

export type Typography = {
  fonts: { display: string; title: string; detail: string; prose: string };
  /** Interletrado de los títulos grandes (opcional). */
  displayLetterSpacing?: number;
  displayFactor: number;
  proseScale: number;
  /** Engordar la serif con una sombra (solo hace falta con letras de un único grosor). */
  fakeBold: boolean;
};

export const typography: Typography = {
  fonts: {
    display: 'Fraunces_800ExtraBold',
    title: 'PlusJakartaSans_700Bold',
    detail: 'PlusJakartaSans_400Regular',
    prose: 'Fraunces_400Regular_Italic',
  },
  displayFactor: 0.8,
  proseScale: 1,
  fakeBold: false,
};

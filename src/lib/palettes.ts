// Paletas de prueba con la regla 60-30-10 (petición del usuario, a partir de unas imágenes).
//
// Cada paleta tiene tres colores: el de arriba ocupa ~60 % de la app, el del medio ~30 % y el de
// abajo ~10 %, para destacar. Cómo se reparten en la interfaz:
//  - 60 % → el fondo de todas las pantallas (y las cabeceras, que se funden con él).
//  - 30 % → según la paleta, el color de las letras (Grafito, Marino: plata y blanco sobre
//    oscuro; Avena, Mantequilla: azul y coral oscurecidos lo justo para leerse) o el de las
//    tarjetas (Salvia: tarjetas hueso sobre fondo salvia).
//  - 10 % → botones principales, totales, la pestaña activa, iconos de acción: lo que destaca.
// Algunos colores están un poco oscurecidos para que el texto se lea (contraste AA, con test):
// p. ej. el rojo tomate o la mandarina como botón con letra blanca.
//
// 'cine' es el estilo de siempre (con su tema y su color de destaque); las paletas lo
// sustituyen entero mientras se prueban. El estilo de siempre está también en la etiqueta de Git
// `estilo-cine-dorado`.

export type PaletteName = 'cine' | 'grafito' | 'marino' | 'salvia' | 'avena' | 'mantequilla';

export type PaletteColors = {
  background: string;
  surface: string;
  elevated: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primarySoft: string;
  flame: string;
  onPrimary: string;
  danger: string;
};

export type Palette = {
  label: string;
  /** Los tres colores de la imagen (60, 30, 10), para la muestra en Configuración. */
  swatches: [string, string, string];
  mode: 'light' | 'dark';
  colors: PaletteColors;
};

export const PALETTES: Record<Exclude<PaletteName, 'cine'>, Palette> = {
  grafito: {
    label: 'Grafito',
    swatches: ['#2B2D31', '#D9DADC', '#FFC93C'],
    mode: 'dark',
    colors: {
      background: '#2B2D31',
      surface: '#35373C',
      elevated: '#404248',
      text: '#D9DADC',
      textMuted: '#A3A5AA',
      border: 'rgba(217,218,220,0.14)',
      primary: '#FFC93C',
      primarySoft: '#4A4331',
      flame: '#FF8A3D',
      onPrimary: '#2B2D31',
      danger: '#FF6B6B',
    },
  },
  marino: {
    label: 'Marino',
    swatches: ['#0F1B3D', '#FFFFFF', '#FF3D8B'],
    mode: 'dark',
    colors: {
      background: '#0F1B3D',
      surface: '#1A2850',
      elevated: '#24345F',
      text: '#FFFFFF',
      textMuted: '#B4BCD3',
      border: 'rgba(255,255,255,0.12)',
      primary: '#FF3D8B',
      primarySoft: '#3A2150',
      flame: '#FF8A3D',
      onPrimary: '#0F1B3D',
      danger: '#FF6B6B',
    },
  },
  salvia: {
    label: 'Salvia',
    swatches: ['#9CAF88', '#F7F5EF', '#E8412C'],
    mode: 'light',
    colors: {
      background: '#9CAF88',
      surface: '#F7F5EF',
      elevated: '#E6E9DA',
      text: '#1C2618',
      textMuted: '#34402F',
      border: 'rgba(28,38,24,0.14)',
      primary: '#B52A15',
      primarySoft: '#F5DAD3',
      flame: '#B52A15',
      onPrimary: '#FFFFFF',
      danger: '#9E1B10',
    },
  },
  avena: {
    label: 'Avena',
    swatches: ['#E9E5D6', '#2589D8', '#FF783D'],
    mode: 'light',
    colors: {
      background: '#E9E5D6',
      surface: '#F4F1E7',
      elevated: '#DCD6C2',
      text: '#1B5F99',
      textMuted: '#436585',
      border: 'rgba(27,95,153,0.16)',
      primary: '#BE4A14',
      primarySoft: '#F6DCCB',
      flame: '#BE4A14',
      onPrimary: '#FFFFFF',
      danger: '#B3261E',
    },
  },
  mantequilla: {
    label: 'Mantequilla',
    swatches: ['#F5E8CC', '#F34E3D', '#55263D'],
    mode: 'light',
    colors: {
      background: '#F5E8CC',
      surface: '#FBF3E2',
      elevated: '#EEDCB8',
      text: '#B02E1E',
      textMuted: '#8A4A3E',
      border: 'rgba(176,46,30,0.16)',
      primary: '#55263D',
      primarySoft: '#EBD3D6',
      flame: '#B02E1E',
      onPrimary: '#F5E8CC',
      danger: '#9E1B10',
    },
  },
};

export const PALETTE_NAMES = Object.keys(PALETTES) as Exclude<PaletteName, 'cine'>[];

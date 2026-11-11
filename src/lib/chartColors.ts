import { isCinema } from './theme';

// Colores para distinguir contadores en las gráficas. Elegidos para verse bien sobre fondo claro
// y oscuro y distinguirse entre sí; el primero es el morado de la app. En el estilo Cine, el
// dorado primero y después tonos apagados (terracota, lavanda, salvia, azul polvo…), nunca neón.
const CINEMA_COLORS = [
  '#E9C46A',
  '#D98466',
  '#A98BD4',
  '#7FAE8B',
  '#6FA3C7',
  // Topo: se ve en claro y en oscuro (antes, blanco hueso, que en el modo claro no se veía).
  '#9C8F7A',
  '#C9A44A',
  '#B5735C',
  '#8C78B0',
  '#6E9378',
];

const CLASSIC_COLORS = [
  '#6C5CE7',
  '#F2994A',
  '#16A085',
  '#E84393',
  '#2F80ED',
  '#D4A017',
  '#27AE60',
  '#9B6B4F',
  '#00A8C6',
  '#EB5757',
];

export const CHART_COLORS = isCinema ? CINEMA_COLORS : CLASSIC_COLORS;

/** Color estable para la posición `index` (se repiten si hay más contadores que colores). */
export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? '#6C5CE7';
}

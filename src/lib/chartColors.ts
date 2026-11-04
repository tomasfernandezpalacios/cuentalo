// Colores para distinguir contadores en las gráficas. Elegidos para verse bien sobre fondo claro
// y oscuro y distinguirse entre sí; el primero es el verde de la app.
export const CHART_COLORS = [
  '#009146',
  '#F2994A',
  '#6C5CE7',
  '#E84393',
  '#2F80ED',
  '#D4A017',
  '#A0522D',
  '#9B6B4F',
  '#00A8C6',
  '#EB5757',
];

/** Color estable para la posición `index` (se repiten si hay más contadores que colores). */
export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? '#009146';
}

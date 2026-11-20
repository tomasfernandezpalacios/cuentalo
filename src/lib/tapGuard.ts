/**
 * Distingue un toque de un deslizamiento (petición del usuario: al deslizar para cambiar de
 * pestaña se abría, por ejemplo, la gráfica de Estadísticas a la vez).
 *
 * Un toque solo cuenta si el dedo se levanta cerca de donde bajó (`isTap`) y si en ese momento
 * no se está pasando de una pestaña a otra (`isSwiping`). No añade ningún retraso: el toque de
 * verdad responde igual de rápido que antes.
 */

/** Cuánto se puede mover el dedo (en puntos) y seguir siendo un toque. */
export const TAP_SLOP = 10;

/** Tiempo tras acabar un deslizamiento de pestañas en el que todavía no se aceptan toques. */
const AFTER_SWIPE_MS = 250;

let swiping = false;
let swipeEndedAt = 0;

/** Lo llama la barra de pestañas cuando el dedo empieza a arrastrar las páginas. */
export function markSwipeStart(): void {
  swiping = true;
}

/** Lo llama la barra de pestañas cuando el deslizamiento termina. */
export function markSwipeEnd(now = Date.now()): void {
  swiping = false;
  swipeEndedAt = now;
}

/** ¿Se está pasando de pestaña (o se acaba de pasar)? */
export function isSwiping(now = Date.now()): boolean {
  return swiping || now - swipeEndedAt < AFTER_SWIPE_MS;
}

/** ¿El dedo se ha levantado lo bastante cerca de donde bajó para ser un toque? */
export function isTap(
  start: { x: number; y: number } | null,
  end: { x: number | undefined; y: number | undefined },
  slop = TAP_SLOP,
): boolean {
  // Sin posición (p. ej., activado con el lector de pantalla): es un toque.
  const { x, y } = end;
  if (!start || typeof x !== 'number' || typeof y !== 'number') return true;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
  return Math.abs(x - start.x) <= slop && Math.abs(y - start.y) <= slop;
}

/** Solo para los tests. */
export function resetTapGuard(): void {
  swiping = false;
  swipeEndedAt = 0;
}

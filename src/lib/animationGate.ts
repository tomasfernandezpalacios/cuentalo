/**
 * Puerta de animaciones pesadas (la celebración de la racha): mientras una está en marcha, el
 * trabajo que no urge (volver a pedir datos y repintar la app) espera a que acabe, para no robar
 * hilo de JavaScript a la animación y que no vaya a tirones.
 */

/** Por si una animación no avisa de que ha terminado: la puerta se abre sola. */
const MAX_MS = 6000;

let busy = false;
let failsafe: ReturnType<typeof setTimeout> | null = null;
let waiting: (() => void)[] = [];

export function isAnimationBusy() {
  return busy;
}

export function setAnimationBusy(value: boolean) {
  if (failsafe) clearTimeout(failsafe);
  failsafe = null;
  busy = value;
  if (value) {
    failsafe = setTimeout(() => setAnimationBusy(false), MAX_MS);
    return;
  }
  const run = waiting;
  waiting = [];
  run.forEach((fn) => fn());
}

/** Ejecuta `fn` ya si no hay animación, o justo cuando termine. */
export function whenAnimationIdle(fn: () => void) {
  if (!busy) fn();
  else waiting.push(fn);
}

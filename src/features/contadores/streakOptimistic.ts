import type { CounterStreak } from './api';

/**
 * Racha de un contador tras sumar `delta` a lo mío de HOY, antes de que responda el servidor
 * (como el total: se ve al instante). Un día cuenta si lo sumado ese día es +1 o más:
 *  - si hoy pasa a cumplirse, la racha crece en 1 (la de ayer seguía viva, o empieza en 1);
 *  - si hoy deja de cumplirse (un −1), vuelve a lo que llevaba hasta ayer.
 * El récord sube si hace falta; si baja, lo corrige el servidor al refrescar.
 */
export function bumpStreak(streak: CounterStreak, delta: number): CounterStreak {
  const todayAmount = streak.todayAmount + delta;
  const todayDone = todayAmount >= 1;
  let current = streak.current;
  if (!streak.todayDone && todayDone) current += 1;
  if (streak.todayDone && !todayDone) current = Math.max(0, current - 1);
  return { current, best: Math.max(streak.best, current), todayDone, todayAmount };
}

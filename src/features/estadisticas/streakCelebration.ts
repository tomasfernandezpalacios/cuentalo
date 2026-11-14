import type { QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { counterKeys } from '@/features/contadores/hooks';

import { localToday } from './periods';
import { currentStreak } from './streaks';

/**
 * Celebración de la racha en la barra de pestañas (petición del usuario): con el primer registro
 * del día, la racha sube y la barra lo enseña con una animación de fuego (`StreakCelebrationBar`).
 */
export type StreakCelebration = { id: number; from: number; to: number };

let current: StreakCelebration | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** La celebración en marcha (o null). */
export function useStreakCelebration(): StreakCelebration | null {
  return useSyncExternalStore(subscribe, () => current);
}

export function celebrateStreak(from: number, to: number) {
  current = { id: nextId++, from, to };
  emit();
}

/** La barra avisa de que ha terminado (solo si sigue siendo la misma celebración). */
export function finishStreakCelebration(id: number) {
  if (current?.id !== id) return;
  current = null;
  emit();
}

/**
 * Si hoy aún no había ningún registro, cuánto sube la racha al registrar ahora (función pura,
 * con tests). La racha de ayer sigue viva hasta que acaba hoy, así que `from` es la de ayer.
 */
export function streakIncrease(
  days: readonly string[],
  today: string,
): { from: number; to: number } | null {
  if (days.includes(today)) return null;
  return { from: currentStreak(days, today), to: currentStreak([today, ...days], today) };
}

/**
 * Llamar justo al registrar algo: si es lo primero de hoy, marca la racha de hoy como mantenida
 * en la caché (la llama se pone en color al instante, sin esperar al servidor) y lanza la
 * celebración. El refresco de después trae los días reales del servidor.
 */
export function markTodayActive(queryClient: QueryClient, userId: string) {
  if (userId === '') return;
  const key = [...counterKeys.all, 'activity', userId];
  const days = queryClient.getQueryData<string[]>(key);
  if (!days) return;
  const today = localToday();
  const increase = streakIncrease(days, today);
  if (!increase) return;
  queryClient.setQueryData(key, [today, ...days]);
  celebrateStreak(increase.from, increase.to);
}

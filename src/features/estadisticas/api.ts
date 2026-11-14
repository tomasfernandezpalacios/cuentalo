import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';
import { counterKeys } from '@/features/contadores/hooks';
import { supabase } from '@/lib/supabase';

import { localToday, type DailyTotal } from './periods';
import { bestStreak, currentStreak } from './streaks';

// Supabase devuelve como máximo 1000 filas por consulta, así que los días se piden por páginas.
const PAGE_SIZE = 1000;

/**
 * Mis totales diarios en todos los contadores (privados y compartidos). Llegan en una sola
 * petición, como JSON (sin el límite de 1000 filas ni páginas que vuelvan a calcular todo).
 */
export async function fetchMyDailyTotals(): Promise<DailyTotal[]> {
  const { data, error } = await supabase.rpc('get_my_daily_totals');
  if (error) throw error;
  return (
    data as { counter_id: string; day: string; total: number; entry_count: number }[]
  ).map((row) => ({
    counterId: row.counter_id,
    day: row.day,
    total: Number(row.total),
    entryCount: row.entry_count,
  }));
}

// La clave cuelga de counterKeys.all para que cualquier registro nuevo refresque las estadísticas.
export function useMyDailyTotals(userId: string) {
  return useQuery({
    queryKey: counterKeys.dailyTotals(userId),
    queryFn: fetchMyDailyTotals,
    enabled: userId !== '',
  });
}

// --- Rachas -----------------------------------------------------------------------------------

/** Días ('AAAA-MM-DD', hora del móvil) en los que he registrado algo. */
export async function fetchMyActivityDays(userId: string): Promise<string[]> {
  const days: string[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('user_activity_days')
      .select('day')
      .eq('user_id', userId)
      .order('day', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    days.push(...data.map((row) => row.day));
    if (data.length < PAGE_SIZE) return days;
  }
}

/** Mi racha actual, la mejor y los días activos (para el calendario). */
export function useStreak() {
  const userId = useUserId();
  return useQuery({
    // Cuelga de counterKeys.all: al registrar algo se refresca sola.
    queryKey: [...counterKeys.all, 'activity', userId],
    queryFn: () => fetchMyActivityDays(userId),
    enabled: userId !== '',
    select: (days) => {
      const today = localToday();
      return {
        days: new Set(days),
        current: currentStreak(days, today),
        best: bestStreak(days),
        /** Hoy ya he registrado algo: la racha de hoy está mantenida. */
        todayDone: days.includes(today),
      };
    },
  });
}

export type FriendStreak = {
  userId: string;
  username: string;
  displayName: string;
  current: number;
  best: number;
  /** Hoy ya ha registrado algo (la llama sale en color; si no, en gris). */
  activeToday: boolean;
};

/**
 * Racha actual y mejor racha mías y de mis amigos aceptados, de mayor a menor racha actual
 * (a igualdad, mejor racha y luego nombre). Solo números: los días de cada uno son privados.
 */
export async function fetchFriendsStreaks(): Promise<FriendStreak[]> {
  const { data, error } = await supabase.rpc('get_friends_streaks');
  if (error) throw error;
  return data
    .map((row) => ({
      userId: row.user_id,
      username: row.username,
      displayName: row.display_name,
      current: row.current_streak,
      best: row.best_streak,
      activeToday: row.active_today === true,
    }))
    .sort(
      (a, b) =>
        b.current - a.current ||
        b.best - a.best ||
        a.displayName.localeCompare(b.displayName, 'es', { sensitivity: 'base' }),
    );
}

export function useFriendsStreaks() {
  const userId = useUserId();
  return useQuery({
    // Cuelga de counterKeys.all para que mi fila se actualice al registrar.
    queryKey: [...counterKeys.all, 'friends-streaks', userId],
    queryFn: fetchFriendsStreaks,
    enabled: userId !== '',
  });
}

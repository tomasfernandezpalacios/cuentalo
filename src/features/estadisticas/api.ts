import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';
import { counterKeys } from '@/features/contadores/hooks';
import { supabase } from '@/lib/supabase';

import { todayInMadrid, type DailyTotal } from './periods';
import { bestStreak, currentStreak } from './streaks';

// Supabase devuelve como máximo 1000 filas por consulta, así que pedimos por páginas.
const PAGE_SIZE = 1000;

/** Mis totales diarios en todos los contadores (privados y, más adelante, compartidos). */
export async function fetchMyDailyTotals(userId: string): Promise<DailyTotal[]> {
  const rows: DailyTotal[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('entry_daily_totals')
      .select('counter_id, day, total, entry_count')
      .eq('user_id', userId)
      .order('day')
      .order('counter_id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    for (const row of data) {
      rows.push({
        counterId: row.counter_id,
        day: row.day,
        total: row.total,
        entryCount: row.entry_count,
      });
    }
    if (data.length < PAGE_SIZE) return rows;
  }
}

// La clave cuelga de counterKeys.all para que cualquier registro nuevo refresque las estadísticas.
export function useMyDailyTotals(userId: string) {
  return useQuery({
    queryKey: [...counterKeys.all, 'daily-totals', userId],
    queryFn: () => fetchMyDailyTotals(userId),
    enabled: userId !== '',
  });
}

// --- Rachas -----------------------------------------------------------------------------------

/** Días ('AAAA-MM-DD', Madrid) en los que he registrado algo. */
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
      const today = todayInMadrid();
      return {
        days: new Set(days),
        current: currentStreak(days, today),
        best: bestStreak(days),
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

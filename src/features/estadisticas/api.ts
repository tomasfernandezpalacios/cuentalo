import { useQuery } from '@tanstack/react-query';

import { counterKeys } from '@/features/contadores/hooks';
import { supabase } from '@/lib/supabase';

import type { DailyTotal } from './periods';

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

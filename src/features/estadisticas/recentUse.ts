import type { CounterWithTotal } from '@/features/contadores/api';

import type { DailyTotal } from './periods';

/**
 * Ordena de uso más reciente a menos. Manda el último día en que *yo* registré algo (de mis
 * totales diarios); a igualdad de día, el último registro visible del contador, y si nunca lo he
 * usado, al final en orden alfabético.
 */
export function sortByRecentUse(
  counters: CounterWithTotal[],
  myDays: DailyTotal[],
): CounterWithTotal[] {
  const lastDay = new Map<string, string>();
  for (const row of myDays) {
    const current = lastDay.get(row.counterId);
    if (!current || row.day > current) lastDay.set(row.counterId, row.day);
  }
  return [...counters].sort(
    (a, b) =>
      (lastDay.get(b.id) ?? '').localeCompare(lastDay.get(a.id) ?? '') ||
      (b.lastLoggedAt ?? '').localeCompare(a.lastLoggedAt ?? '') ||
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
  );
}

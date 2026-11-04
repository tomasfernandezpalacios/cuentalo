import type { CounterWithTotal } from '@/features/contadores/api';

import type { Period, Summary } from './periods';

export type CounterStats = {
  id: string;
  name: string;
  unit: string | null;
  emoji: string | null;
  archived: boolean;
} & Summary;

const UNKNOWN_COUNTER = { name: 'Contador sin acceso', unit: null, emoji: null, archived: true };

/**
 * Une los resúmenes por contador con los datos de cada contador para un periodo. Incluye los
 * contadores activos aunque no tengan registros y los registros de contadores que ya no veo
 * (p. ej. de un grupo del que he salido), para no perder estadísticas personales.
 */
export function buildCounterStats(
  counters: CounterWithTotal[],
  summaries: Map<string, Record<Period, Summary>>,
  period: Period,
): CounterStats[] {
  const byId = new Map(counters.map((c) => [c.id, c]));
  const ids = new Set([
    ...counters.filter((c) => c.isActive && !c.archived && !c.linkedInto).map((c) => c.id),
    ...summaries.keys(),
  ]);

  return [...ids].map((id) => {
    const counter = byId.get(id) ?? UNKNOWN_COUNTER;
    const summary = summaries.get(id)?.[period] ?? { total: 0, entryCount: 0 };
    return {
      id,
      name: counter.name,
      unit: counter.unit,
      emoji: counter.emoji,
      archived: counter.archived,
      ...summary,
    };
  });
}

/** Los contadores con más registros en el periodo (descarta los que no tienen ninguno). */
export function mostUsed(stats: CounterStats[], limit = 3): CounterStats[] {
  return stats
    .filter((s) => s.entryCount > 0)
    .sort((a, b) => b.entryCount - a.entryCount || b.total - a.total)
    .slice(0, limit);
}

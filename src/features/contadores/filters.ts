// Filtros de la lista de contadores. Funciones puras para poder testearlas.

import type { CounterWithTotal } from './api';
import type { Folder } from './folders';

export type CounterKind = 'all' | 'individual' | 'group';
export type ActivityWindow = 'any' | 'day' | 'week' | 'month' | 'year';

export type CounterFilters = {
  /** null = "Todos". */
  folderId: string | null;
  kind: CounterKind;
  activity: ActivityWindow;
};

export const DEFAULT_FILTERS: CounterFilters = { folderId: null, kind: 'all', activity: 'any' };

// Ventanas móviles hacia atrás desde ahora: "último día" = últimas 24 h, etc.
const WINDOW_DAYS: Record<Exclude<ActivityWindow, 'any'>, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

/** Número de filtros activos, para marcar el botón de filtros. */
export function activeFilterCount({ folderId, kind, activity }: CounterFilters): number {
  return Number(folderId !== null) + Number(kind !== 'all') + Number(activity !== 'any');
}

export function filterCounters(
  counters: CounterWithTotal[],
  filters: CounterFilters,
  folders: Folder[],
  now: Date = new Date(),
): CounterWithTotal[] {
  const folder = filters.folderId ? folders.find((f) => f.id === filters.folderId) : undefined;
  const inFolder = folder ? new Set(folder.counterIds) : null;
  const since =
    filters.activity === 'any' ? null : now.getTime() - WINDOW_DAYS[filters.activity] * 86_400_000;

  return counters.filter((counter) => {
    if (inFolder && !inFolder.has(counter.id)) return false;
    if (filters.kind === 'individual' && counter.group_id !== null) return false;
    if (filters.kind === 'group' && counter.group_id === null) return false;
    if (since !== null) {
      const last = counter.lastLoggedAt;
      if (!last || new Date(last).getTime() < since) return false;
    }
    return true;
  });
}

// Filtros de la lista de contadores. Funciones puras para poder testearlas.

import type { CounterWithTotal } from './api';
import type { Folder } from './folders';

export type CounterKind = 'all' | 'individual' | 'group';
export type ActivityWindow = 'any' | 'day' | 'week' | 'month' | 'year';

export type CounterFilters = {
  /** null = "Todos". */
  folderId: string | null;
  kind: CounterKind;
  /** Con kind = 'group': solo los de este grupo (null = de cualquier grupo). */
  groupId: string | null;
  activity: ActivityWindow;
};

export const DEFAULT_FILTERS: CounterFilters = {
  folderId: null,
  kind: 'all',
  groupId: null,
  activity: 'any',
};

// Ventanas móviles hacia atrás desde ahora: "último día" = últimas 24 h, etc.
const WINDOW_DAYS: Record<Exclude<ActivityWindow, 'any'>, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

/** Número de filtros activos, para marcar el botón de filtros. */
export function activeFilterCount({ folderId, kind, activity }: CounterFilters): number {
  // Elegir un grupo concreto es parte del filtro «De grupo»: no cuenta aparte.
  return Number(folderId !== null) + Number(kind !== 'all') + Number(activity !== 'any');
}

/** ¿Cuenta este contador en el grupo? (También si está enlazado con uno de ese grupo.) */
function belongsToGroup(counter: CounterWithTotal, groupId: string): boolean {
  return (
    counter.group_id === groupId ||
    (counter.linkedGroups ?? []).some((linked) => linked.group.id === groupId)
  );
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
    if (filters.kind === 'group' && filters.groupId && !belongsToGroup(counter, filters.groupId)) {
      return false;
    }
    if (since !== null) {
      const last = counter.lastLoggedAt;
      if (!last || new Date(last).getTime() < since) return false;
    }
    return true;
  });
}

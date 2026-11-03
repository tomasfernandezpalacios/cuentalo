import { useSyncExternalStore } from 'react';

// Qué contadores salen en la barra de Estadísticas y cuáles se dibujan en la gráfica. Se
// comparte entre la pestaña y la pantalla de filtros, y vive en memoria: al abrir la app se
// vuelve a la vista por defecto.

export type StatsSelection = {
  /** Contadores de la barra; null = todos. */
  pool: string[] | null;
  /** Contadores dibujados; null = por defecto (el último que usaste). */
  visible: string[] | null;
};

let selection: StatsSelection = { pool: null, visible: null };
const listeners = new Set<() => void>();

function set(next: StatsSelection) {
  selection = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStatsSelection(): StatsSelection {
  return useSyncExternalStore(subscribe, () => selection);
}

/** Aplica los filtros: la barra pasa a tener esos contadores y se dibujan todos. */
export function applyStatsFilter(ids: string[]) {
  set(ids.length === 0 ? { pool: null, visible: null } : { pool: ids, visible: ids });
}

/** Quita o vuelve a poner un contador en la gráfica. */
export function toggleVisible(id: string, currentlyVisible: string[]) {
  const visible = currentlyVisible.includes(id)
    ? currentlyVisible.filter((v) => v !== id)
    : [...currentlyVisible, id];
  set({ ...selection, visible });
}

export function resetStatsSelection() {
  set({ pool: null, visible: null });
}

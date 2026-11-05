// Orden personal de listas (bloques de Estadísticas, contadores). Funciones puras, con tests.

/** Mueve el elemento de `from` a `to` (índices) y devuelve una lista nueva. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item as T);
  return next;
}

/**
 * Ordena `items` según `order` (lista de ids). Los que no están en `order` (p. ej. uno nuevo)
 * van al final, en el orden en que venían.
 */
export function applyOrder<T>(
  items: T[],
  order: string[] | null | undefined,
  id: (item: T) => string,
): T[] {
  if (!order || order.length === 0) return items;
  const position = new Map(order.map((value, index) => [value, index]));
  return items
    .map((item, index) => ({ item, index, pos: position.get(id(item)) }))
    .sort((a, b) => {
      if (a.pos !== undefined && b.pos !== undefined) return a.pos - b.pos;
      if (a.pos !== undefined) return -1;
      if (b.pos !== undefined) return 1;
      return a.index - b.index;
    })
    .map((x) => x.item);
}

/**
 * Índice al que va un elemento arrastrado `dy` píxeles desde `from`, sabiendo la altura de cada
 * elemento: cruza al vecino cuando su centro pasa por el centro del vecino.
 */
export function dropIndex(heights: number[], from: number, dy: number): number {
  let index = from;
  let moved = dy;
  if (dy > 0) {
    while (index < heights.length - 1) {
      const next = heights[index + 1] ?? 0;
      if (moved < next / 2) break;
      moved -= next;
      index++;
    }
  } else {
    while (index > 0) {
      const prev = heights[index - 1] ?? 0;
      if (-moved < prev / 2) break;
      moved += prev;
      index--;
    }
  }
  return index;
}

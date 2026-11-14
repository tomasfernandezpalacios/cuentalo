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

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

/**
 * Posición (esquina superior izquierda) de cada hueco, en el orden dado.
 * - Una columna: uno debajo de otro, cada uno con su altura.
 * - Varias columnas (cuadrícula): celdas iguales (las del más grande), fila a fila.
 */
export function slotPositions(sizes: Size[], columns: number, gap: number): Point[] {
  if (columns <= 1) {
    let y = 0;
    return sizes.map((size) => {
      const point = { x: 0, y };
      y += size.height + gap;
      return point;
    });
  }
  const cell = cellSize(sizes);
  return sizes.map((_, index) => ({
    x: (index % columns) * (cell.width + gap),
    y: Math.floor(index / columns) * (cell.height + gap),
  }));
}

function cellSize(sizes: Size[]): Size {
  return sizes.reduce(
    (max, s) => ({ width: Math.max(max.width, s.width), height: Math.max(max.height, s.height) }),
    { width: 0, height: 0 },
  );
}

/**
 * Cuadrícula: hueco al que va un elemento que estaba en `from` y se ha movido (dx, dy): el de la
 * celda en la que cae su centro.
 */
export function gridDropIndex(
  sizes: Size[],
  columns: number,
  gap: number,
  from: number,
  dx: number,
  dy: number,
): number {
  const cell = cellSize(sizes);
  if (cell.width === 0 || cell.height === 0) return from;
  const stepX = cell.width + gap;
  const stepY = cell.height + gap;
  const fromCol = from % columns;
  const fromRow = Math.floor(from / columns);
  const rows = Math.ceil(sizes.length / columns);
  const col = Math.max(0, Math.min(columns - 1, Math.round(fromCol + dx / stepX)));
  const row = Math.max(0, Math.min(rows - 1, Math.round(fromRow + dy / stepY)));
  return Math.min(sizes.length - 1, row * columns + col);
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

/**
 * Orden con `id` el primero (p. ej. un contador recién creado). Vale para las dos vistas de «Mis
 * contadores» (filas y bloques), que comparten el orden guardado.
 */
export function withFirst(order: string[], id: string): string[] {
  return [id, ...order.filter((value) => value !== id)];
}

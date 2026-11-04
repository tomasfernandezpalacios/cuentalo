// Rachas: días seguidos con actividad. Funciones puras con días 'AAAA-MM-DD' (hora de Madrid).

const DAY_MS = 86_400_000;

function shift(day: string, days: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Días seguidos hacia atrás desde `from` (incluido) que están en `active`. */
function runEndingAt(active: Set<string>, from: string): number {
  let count = 0;
  for (let day = from; active.has(day); day = shift(day, -1)) count++;
  return count;
}

/**
 * Racha actual. Si hoy ya hay actividad, cuenta desde hoy; si no, la de ayer sigue viva hasta que
 * acabe el día. Si tampoco hubo ayer, es 0.
 */
export function currentStreak(activeDays: Iterable<string>, today: string): number {
  const active = new Set(activeDays);
  return active.has(today) ? runEndingAt(active, today) : runEndingAt(active, shift(today, -1));
}

/** La racha más larga de toda la historia. */
export function bestStreak(activeDays: Iterable<string>): number {
  const active = new Set(activeDays);
  let best = 0;
  for (const day of active) {
    // Solo se cuenta desde el primer día de cada racha.
    if (active.has(shift(day, -1))) continue;
    let length = 0;
    for (let d = day; active.has(d); d = shift(d, 1)) length++;
    best = Math.max(best, length);
  }
  return best;
}

/**
 * Semanas del mes para el calendario (lunes primero). Cada semana tiene 7 huecos: el día
 * 'AAAA-MM-DD' o null para los huecos de otros meses.
 */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // lunes = 0
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * Posiciones de una clasificación ya ordenada de mayor a menor: quien empata en `value` comparte
 * puesto (1, 2, 2, 4…).
 */
export function withPositions<T>(
  rows: T[],
  value: (row: T) => number,
): (T & { position: number })[] {
  return rows.map((row, index) => {
    let first = index;
    while (first > 0 && value(rows[first - 1] as T) === value(row)) first--;
    return { ...row, position: first + 1 };
  });
}

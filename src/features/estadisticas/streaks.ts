// Rachas: días seguidos con actividad. Funciones puras con días 'AAAA-MM-DD' (hora del móvil).

const DAY_MS = 86_400_000;

function shift(day: string, days: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * Días seguidos hacia atrás desde `from` (incluido) que están en `active`. Los días protegidos
 * (`shielded`, un protector de racha) no rompen la racha, pero tampoco la alargan.
 */
function runEndingAt(active: Set<string>, shielded: Set<string>, from: string): number {
  let count = 0;
  for (let day = from; active.has(day) || shielded.has(day); day = shift(day, -1)) {
    if (active.has(day)) count++;
  }
  return count;
}

/**
 * Racha actual. Si hoy ya hay actividad, cuenta desde hoy; si no, la de ayer sigue viva hasta que
 * acabe el día. Si tampoco hubo ayer (ni lo cubrió un protector), es 0.
 */
export function currentStreak(
  activeDays: Iterable<string>,
  today: string,
  shieldedDays: Iterable<string> = [],
): number {
  const active = new Set(activeDays);
  const shielded = new Set(shieldedDays);
  return active.has(today)
    ? runEndingAt(active, shielded, today)
    : runEndingAt(active, shielded, shift(today, -1));
}

/** La racha más larga de toda la historia (los días protegidos la unen sin sumar). */
export function bestStreak(
  activeDays: Iterable<string>,
  shieldedDays: Iterable<string> = [],
): number {
  const active = new Set(activeDays);
  const shielded = new Set(shieldedDays);
  const kept = (day: string) => active.has(day) || shielded.has(day);
  let best = 0;
  for (const day of new Set([...active, ...shielded])) {
    // Solo se cuenta desde el primer día de cada racha.
    if (kept(shift(day, -1))) continue;
    let length = 0;
    for (let d = day; kept(d); d = shift(d, 1)) if (active.has(d)) length++;
    best = Math.max(best, length);
  }
  return best;
}

/**
 * Protectores de racha que hay que gastar hoy: si ayer no hubo actividad y la racha venía viva,
 * los días sin nada entre el último día mantenido y ayer se cubren con protectores, siempre que
 * haya suficientes para todos (si no, la racha se pierde y no se gasta ninguno). Devuelve esos
 * días (vacío si no hace falta ninguno).
 */
export function shieldsToUse(
  activeDays: Iterable<string>,
  shieldedDays: Iterable<string>,
  available: number,
  today: string,
): string[] {
  const kept = new Set([...activeDays, ...shieldedDays]);
  const yesterday = shift(today, -1);
  if (kept.has(yesterday) || available <= 0) return [];
  const before = [...kept].filter((day) => day < yesterday).sort();
  const last = before[before.length - 1];
  if (!last) return [];
  const gap: string[] = [];
  for (let day = shift(last, 1); day <= yesterday; day = shift(day, 1)) gap.push(day);
  return gap.length <= available ? gap : [];
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

export type WeekDay = {
  day: string;
  /** Inicial del día (L, M, X, J, V, S, D). */
  letter: string;
  /** Ese día hubo actividad: la racha se mantuvo. */
  done: boolean;
  isToday: boolean;
  /** Aún no ha llegado. */
  future: boolean;
};

const WEEK_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** La semana actual (lunes → domingo) con los días en que se mantuvo la racha. */
export function weekProgress(activeDays: Iterable<string>, today: string): WeekDay[] {
  const active = new Set(activeDays);
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0
  const monday = shift(today, -weekday);
  return WEEK_LETTERS.map((letter, i) => {
    const day = shift(monday, i);
    return { day, letter, done: active.has(day), isToday: day === today, future: day > today };
  });
}

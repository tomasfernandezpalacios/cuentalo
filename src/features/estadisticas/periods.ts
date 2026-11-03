// Agregación de estadísticas por periodo. Funciones puras (sin red ni React) para poder testearlas.
//
// Trabajan con días en formato 'AAAA-MM-DD' que ya vienen en hora de Europe/Madrid desde la vista
// entry_daily_totals. Los periodos son naturales: semana ISO (lunes a domingo), mes y año.
// La aritmética de fechas se hace en UTC para que el huso horario del móvil no influya.

export type Period = 'week' | 'month' | 'year' | 'all';
export type Granularity = 'week' | 'month' | 'year';

export type DailyTotal = {
  counterId: string;
  day: string;
  total: number;
  entryCount: number;
};

export type Summary = { total: number; entryCount: number };

export type SeriesPoint = { key: string; label: string; total: number };

const DAY_MS = 86_400_000;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  return formatDay(new Date(parseDay(day).getTime() + days * DAY_MS));
}

/** Fecha de hoy en Madrid, en formato 'AAAA-MM-DD'. */
export function todayInMadrid(now: Date = new Date()): string {
  // 'en-CA' formatea como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Lunes de la semana ISO que contiene el día. */
export function startOfIsoWeek(day: string): string {
  const weekday = (parseDay(day).getUTCDay() + 6) % 7; // lunes = 0 … domingo = 6
  return addDays(day, -weekday);
}

/** Clave del periodo al que pertenece un día: lunes de la semana, 'AAAA-MM' o 'AAAA'. */
export function bucketKey(day: string, granularity: Granularity): string {
  if (granularity === 'week') return startOfIsoWeek(day);
  if (granularity === 'month') return day.slice(0, 7);
  return day.slice(0, 4);
}

/** ¿Está el día dentro del periodo actual (según la fecha de hoy)? */
export function isInPeriod(day: string, today: string, period: Period): boolean {
  if (period === 'all') return true;
  return day <= today && bucketKey(day, period) === bucketKey(today, period);
}

function emptySummary(): Record<Period, Summary> {
  return {
    week: { total: 0, entryCount: 0 },
    month: { total: 0, entryCount: 0 },
    year: { total: 0, entryCount: 0 },
    all: { total: 0, entryCount: 0 },
  };
}

const PERIODS: Period[] = ['week', 'month', 'year', 'all'];

/** Total y número de registros de cada contador en cada periodo. */
export function summarizeByCounter(
  days: DailyTotal[],
  today: string,
): Map<string, Record<Period, Summary>> {
  const result = new Map<string, Record<Period, Summary>>();
  for (const row of days) {
    const summary = result.get(row.counterId) ?? emptySummary();
    for (const period of PERIODS) {
      if (isInPeriod(row.day, today, period)) {
        summary[period].total += row.total;
        summary[period].entryCount += row.entryCount;
      }
    }
    result.set(row.counterId, summary);
  }
  return result;
}

/** Clave del periodo anterior: una semana, un mes o un año antes. */
function previousKey(key: string, granularity: Granularity): string {
  if (granularity === 'week') return addDays(key, -7);
  if (granularity === 'year') return String(Number(key) - 1);
  const [year, month] = key.split('-').map(Number) as [number, number];
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}

function labelFor(key: string, granularity: Granularity): string {
  if (granularity === 'year') return key;
  if (granularity === 'month') {
    const month = MONTHS[Number(key.slice(5, 7)) - 1];
    return key.endsWith('-01') ? `${month} ${key.slice(2, 4)}` : (month ?? key);
  }
  return `${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
}

/**
 * Serie temporal para la gráfica: los últimos `count` periodos hasta el actual (incluido), en orden
 * cronológico y con 0 en los periodos sin registros.
 */
export function buildSeries(
  days: DailyTotal[],
  today: string,
  granularity: Granularity,
  count: number,
): SeriesPoint[] {
  const totals = new Map<string, number>();
  for (const row of days) {
    const key = bucketKey(row.day, granularity);
    totals.set(key, (totals.get(key) ?? 0) + row.total);
  }

  const keys: string[] = [];
  let key = bucketKey(today, granularity);
  for (let i = 0; i < count; i++) {
    keys.unshift(key);
    key = previousKey(key, granularity);
  }
  return keys.map((k) => ({ key: k, label: labelFor(k, granularity), total: totals.get(k) ?? 0 }));
}

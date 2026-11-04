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

function labelFor(key: string, granularity: Granularity): string {
  if (granularity === 'year') return key;
  if (granularity === 'month') {
    const month = MONTHS[Number(key.slice(5, 7)) - 1];
    return key.endsWith('-01') ? `${month} ${key.slice(2, 4)}` : (month ?? key);
  }
  return `${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
}

// --- Gráfica por periodo ----------------------------------------------------------------------
//
// Semana: un punto por día de lunes a hoy. Mes: un punto por día del 1 a hoy. Año: un punto por
// mes de enero al actual. Histórico: un punto por mes desde el primer registro o, si son más de
// dos años, uno por año.

export type ChartBucket = { key: string; label: string };
export type ChartGranularity = 'day' | 'month' | 'year';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MAX_MONTHS_IN_HISTORY = 24;

function nextMonth(key: string): string {
  const [year, month] = key.split('-').map(Number) as [number, number];
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = from; month <= to; month = nextMonth(month)) months.push(month);
  return months;
}

/** Puntos del eje X para el periodo. `firstDay` es el primer día con datos (para el histórico). */
export function chartBuckets(
  period: Period,
  today: string,
  firstDay: string | null,
): { buckets: ChartBucket[]; granularity: ChartGranularity } {
  if (period === 'week') {
    const days = daysBetween(startOfIsoWeek(today), today);
    return {
      granularity: 'day',
      buckets: days.map((day, i) => ({ key: day, label: WEEKDAYS[i] ?? day })),
    };
  }
  if (period === 'month') {
    const days = daysBetween(`${today.slice(0, 7)}-01`, today);
    return {
      granularity: 'day',
      buckets: days.map((day) => ({ key: day, label: String(Number(day.slice(8, 10))) })),
    };
  }
  if (period === 'year') {
    const months = monthsBetween(`${today.slice(0, 4)}-01`, today.slice(0, 7));
    return {
      granularity: 'month',
      buckets: months.map((month) => ({ key: month, label: labelFor(month, 'month') })),
    };
  }

  const start = firstDay && firstDay < today ? firstDay : today;
  const months = monthsBetween(start.slice(0, 7), today.slice(0, 7));
  if (months.length <= MAX_MONTHS_IN_HISTORY) {
    return {
      granularity: 'month',
      buckets: months.map((month) => ({ key: month, label: labelFor(month, 'month') })),
    };
  }
  const years: ChartBucket[] = [];
  for (let year = Number(start.slice(0, 4)); year <= Number(today.slice(0, 4)); year++) {
    years.push({ key: String(year), label: String(year) });
  }
  return { granularity: 'year', buckets: years };
}

/** Total de cada punto del eje X (los días deben ser de un solo contador). */
export function chartValues(
  days: DailyTotal[],
  buckets: ChartBucket[],
  granularity: ChartGranularity,
): number[] {
  const length = granularity === 'day' ? 10 : granularity === 'month' ? 7 : 4;
  const totals = new Map<string, number>();
  for (const row of days) {
    const key = row.day.slice(0, length);
    totals.set(key, (totals.get(key) ?? 0) + row.total);
  }
  return buckets.map((bucket) => totals.get(bucket.key) ?? 0);
}

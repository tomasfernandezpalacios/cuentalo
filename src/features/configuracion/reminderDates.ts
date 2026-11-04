/** Días que se programan por adelantado (se reprograman al abrir la app). */
const DAYS_AHEAD = 14;

/** Fechas (hora local) en las que toca avisar, de hoy (si aún procede) en adelante. */
export function reminderDates(
  now: Date,
  hour: number,
  minute: number,
  skipToday: boolean,
  days = DAYS_AHEAD,
): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, minute);
    if (i === 0 && (skipToday || date <= now)) continue;
    dates.push(date);
  }
  return dates;
}

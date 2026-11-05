// Edad exacta para el resumen («Tu vida en Cuéntalo»). Funciones puras, con fechas del calendario
// de verdad (meses de 28 a 31 días, años bisiestos), desde la medianoche del día de nacimiento
// en la hora del móvil.

export type AgeBreakdown = {
  years: number;
  months: number;
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

/** 'AAAA-MM-DD' → medianoche de ese día en la hora del móvil. */
export function birthStart(birthDate: string): Date {
  const [y, m, d] = birthDate.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Suma meses a una fecha sin pasarse de mes (31 ene + 1 mes = 28/29 feb). */
function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  target.setHours(date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
  return target;
}

/** Años, meses, semanas, días, horas, minutos y segundos desde `birth` hasta `now`. */
export function ageBreakdown(birth: Date, now: Date): AgeBreakdown {
  if (now <= birth)
    return { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (addMonths(birth, months) > now) months--;
  const anchor = addMonths(birth, months);
  // Días por calendario (de medianoche a medianoche, redondeando: así un cambio de hora en
  // medio no suma ni quita una hora) y la hora del día, tal como la marca el reloj del móvil.
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const totalDays = Math.round((midnight.getTime() - anchor.getTime()) / 86_400_000);
  return {
    years: Math.floor(months / 12),
    months: months % 12,
    weeks: Math.floor(totalDays / 7),
    days: totalDays % 7,
    hours: now.getHours(),
    minutes: now.getMinutes(),
    seconds: now.getSeconds(),
  };
}

/** Días, horas y minutos completos vividos desde `birth`. */
export function totalsLived(birth: Date, now: Date) {
  const ms = Math.max(0, now.getTime() - birth.getTime());
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000),
    minutes: Math.floor(ms / 60_000),
  };
}

/** ¿Es una fecha de nacimiento razonable? (ni futura ni de hace más de 120 años). */
export function isValidBirthDate(birthDate: string, today: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;
  const birth = birthStart(birthDate);
  return birth <= today && today.getFullYear() - birth.getFullYear() <= 120;
}

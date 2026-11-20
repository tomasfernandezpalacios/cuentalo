// Calendario del año en el detalle de un contador: una fila por mes y un cuadrado por día
// (365 o 366 en total). Funciones puras, con tests.

export const MONTH_INITIALS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** ¿Año bisiesto? (gregoriano). */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Días que tiene un mes (month de 1 a 12). */
export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Los días del año ('AAAA-MM-DD') agrupados por mes: 12 listas, 365 o 366 días en total. */
export function yearMonths(year: number): string[][] {
  return Array.from({ length: 12 }, (_, i) =>
    Array.from(
      { length: daysInMonth(year, i + 1) },
      (_, d) => `${year}-${pad(i + 1)}-${pad(d + 1)}`,
    ),
  );
}

/** Años que se pueden ver: desde el del primer registro (o el actual) hasta el actual. */
export function selectableYears(today: string, firstDay: string | null): number[] {
  const current = Number(today.slice(0, 4));
  const first = firstDay ? Math.min(Number(firstDay.slice(0, 4)), current) : current;
  return Array.from({ length: current - first + 1 }, (_, i) => first + i);
}

const numberFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

const dateTimeFormat = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatAmount(value: number): string {
  return numberFormat.format(value);
}

export function formatDateTime(value: string | Date): string {
  return dateTimeFormat.format(typeof value === 'string' ? new Date(value) : value);
}

/** "12 cervezas", o solo "12" si el contador no tiene unidad. */
export function formatWithUnit(value: number, unit: string | null): string {
  return unit ? `${formatAmount(value)} ${unit}` : formatAmount(value);
}

/** Con signo explícito, para el historial: "+2 cervezas", "−1 cervezas". */
export function formatSignedWithUnit(value: number, unit: string | null): string {
  return `${value < 0 ? '−' : '+'}${formatWithUnit(Math.abs(value), unit)}`;
}

/** "3 registros", "1 registro". */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatAmount(count)} ${count === 1 ? singular : plural}`;
}

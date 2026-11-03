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

/** "3 registros", "1 registro". */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatAmount(count)} ${count === 1 ? singular : plural}`;
}

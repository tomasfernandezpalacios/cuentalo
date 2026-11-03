// Validaciones de formularios. Devuelven un mensaje de error en español o null si es válido.
// Las mismas reglas están en la base de datos (CHECK), así que esto es solo para dar feedback rápido.

export const LIMITS = {
  counterName: 60,
  groupName: 50,
  folderName: 30,
  unit: 30,
  displayName: 50,
  note: 200,
  maxAmount: 1_000_000_000,
  minPassword: 6,
} as const;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Convierte lo escrito por el usuario ("2,5", " 10 ") en un número positivo. */
export function parseAmount(input: string): ParseResult<number> {
  const normalized = input.trim().replace(',', '.');
  if (normalized === '') return { ok: false, error: 'Escribe una cantidad.' };
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, error: 'La cantidad debe ser un número.' };
  }
  const value = Number(normalized);
  if (value <= 0) return { ok: false, error: 'La cantidad debe ser mayor que 0.' };
  if (value >= LIMITS.maxAmount) return { ok: false, error: 'La cantidad es demasiado grande.' };
  return { ok: true, value };
}

export function validateRequiredText(value: string, label: string, max: number): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return `${label} no puede estar vacío.`;
  if (trimmed.length > max) return `${label} no puede tener más de ${max} caracteres.`;
  return null;
}

/** Como validateRequiredText, pero acepta el texto vacío. */
export function validateOptionalText(value: string, label: string, max: number): string | null {
  return value.trim() === '' ? null : validateRequiredText(value, label, max);
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string): string | null {
  const username = normalizeUsername(value);
  if (username.length < 3 || username.length > 20) {
    return 'El nombre de usuario debe tener entre 3 y 20 caracteres.';
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return 'Usa solo letras minúsculas, números y guiones bajos.';
  }
  return null;
}

export function validateEmail(value: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : 'Escribe un email válido.';
}

export function validatePassword(value: string): string | null {
  return value.length >= LIMITS.minPassword
    ? null
    : `La contraseña debe tener al menos ${LIMITS.minPassword} caracteres.`;
}

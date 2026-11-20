import { Linking } from 'react-native';

/**
 * Edad mínima para usar Cuéntalo: 14 años (art. 7 LOPDGDD). Hay un proyecto de ley que la subiría
 * a 16; si se aprueba, cambiarla aquí y en `public.minimum_age()` (Supabase).
 */
export const MIN_AGE = 14;

/** Versión de las condiciones y la política que se aceptan al registrarse (fecha de la web). */
export const TERMS_VERSION = '2026-11-17';

/** Web legal (carpeta `web/`, publicada con GitHub Pages). */
export const LEGAL_BASE_URL = 'https://tomasfernandezpalacios.github.io/cuentalo';

export const LEGAL_PAGES = {
  privacy: `${LEGAL_BASE_URL}/privacidad.html`,
  terms: `${LEGAL_BASE_URL}/condiciones.html`,
  notice: `${LEGAL_BASE_URL}/aviso-legal.html`,
} as const;

export function openLegalPage(page: keyof typeof LEGAL_PAGES): void {
  void Linking.openURL(LEGAL_PAGES[page]);
}

/**
 * ¿Ha cumplido `minAge` años en `today`? Fechas 'AAAA-MM-DD' y cuentas de calendario (el que
 * nace un 29 de febrero cumple el 1 de marzo en los años no bisiestos).
 */
export function isOldEnough(
  birthDate: string,
  today: Date = new Date(),
  minAge = MIN_AGE,
): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ty = today.getFullYear();
  const tm = today.getMonth() + 1;
  const td = today.getDate();
  let age = ty - year;
  if (tm < month || (tm === month && td < day)) age -= 1;
  return age >= minAge;
}

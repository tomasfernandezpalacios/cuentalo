// Números de teléfono para encontrar a tus contactos en Cuéntalo, sin guardar números.
//
// Cada número se reduce a sus 9 últimas cifras (así «+34 600 11 22 33», «600112233» y
// «0034600112233» son el mismo) y se resume con SHA-256 junto a un prefijo de la app. A Supabase
// solo llegan esos resúmenes: el mío (si decido sincronizarlo) y los de mi agenda para compararlos.

/** Cifras con las que se compara un número. 9 = número nacional en España (y en muchos países). */
export const PHONE_DIGITS = 9;

/** Las últimas cifras de un número, o null si no parece un número de teléfono. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < PHONE_DIGITS) return null;
  return digits.slice(-PHONE_DIGITS);
}

/** Lo que se resume con SHA-256 (el prefijo evita mezclarlo con resúmenes de otras apps). */
export function phoneHashInput(normalized: string): string {
  return `cuentalo:${normalized}`;
}

/** Números distintos ya normalizados (sin repetidos ni inválidos). */
export function uniquePhones(raw: string[]): string[] {
  return [...new Set(raw.map(normalizePhone).filter((n): n is string => n !== null))];
}

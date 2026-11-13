// Unidad que se propone al crear un contador (petición del usuario).

/** Unidad propuesta: la primera palabra del nombre, en minúscula (sin emoticonos ni signos). */
export function suggestUnit(name: string): string {
  const first = name.trim().match(/[\p{L}\p{N}]+/u)?.[0] ?? '';
  return first.toLocaleLowerCase('es');
}

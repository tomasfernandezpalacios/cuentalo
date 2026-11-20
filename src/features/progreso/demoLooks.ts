import type { Move } from '@/features/mascota/moves';

import { CATALOG, type AccessoryId, type BackgroundId, type ShopItem } from './shop';

// PRUEBA: la mascota de otra persona. Mientras el progreso no se guarde en Supabase no sabemos
// qué lleva cada uno, así que se elige con su id (siempre la misma para la misma persona).

export type MascotLook = { background: BackgroundId; accessories: AccessoryId[]; move: Move };

/** Número estable a partir de un texto (hash FNV-1a). */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(list: T[], seed: number): T | undefined {
  return list.length > 0 ? list[seed % list.length] : undefined;
}

/** La mascota de ejemplo de una persona: un fondo, un gorro, a veces algo al cuello, y un baile. */
export function demoLookFor(userId: string): MascotLook {
  const h = hash(userId);
  const of = <K extends ShopItem['kind']>(kind: K) =>
    CATALOG.filter((item): item is Extract<ShopItem, { kind: K }> => item.kind === kind);
  const backgrounds = of('fondo').filter((item) => item.id !== 'papel');
  const heads = of('accesorio').filter((item) => item.slot === 'cabeza');
  const necks = of('accesorio').filter((item) => item.slot === 'cuello');
  const moves = of('animacion');
  const head = pick(heads, h >>> 3);
  const neck = (h >>> 9) % 2 === 0 ? pick(necks, h >>> 11) : undefined;
  return {
    background: pick(backgrounds, h)?.id ?? 'noche',
    accessories: [head?.id, neck?.id].filter((id): id is AccessoryId => id !== undefined),
    move: pick(moves, h >>> 17)?.move ?? 'wave',
  };
}

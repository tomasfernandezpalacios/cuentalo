import type { Move } from '@/features/mascota/moves';

// Catálogo de lo que puede tener tu mascota: accesorios (uno por sitio: cabeza, ojos, cuello),
// fondos (el escenario donde la ves) y animaciones (lo que hace al entrar en «Progreso»). Cada
// cosa se compra con monedas (precio fijo, a veces con nivel mínimo) o te la regalan al llegar a
// un nivel. Sin premios al azar.

export type ItemKind = 'accesorio' | 'fondo' | 'animacion';

export type Slot = 'cabeza' | 'ojos' | 'cuello';

export type AccessoryId =
  | 'gorro'
  | 'pajarita'
  | 'redondas'
  | 'boina'
  | 'gafas'
  | 'gorra'
  | 'corbata'
  | 'lana'
  | 'auriculares'
  | 'panuelo'
  | 'corazones'
  | 'bufanda'
  | 'collar-flores'
  | 'perlas'
  | 'monoculo'
  | 'vaquero'
  | 'parche'
  | 'antifaz'
  | 'flores'
  | 'chistera'
  | 'vikingo'
  | 'chef'
  | 'mago'
  | 'reno'
  | 'medalla'
  | 'corona'
  | 'aureola';

export type BackgroundId =
  | 'papel'
  | 'atardecer'
  | 'noche'
  | 'lluvia'
  | 'bosque'
  | 'habitacion'
  | 'nubes'
  | 'girasoles'
  | 'nieve'
  | 'mar'
  | 'desierto'
  | 'ciudad'
  | 'cerezos'
  | 'otono'
  | 'montana'
  | 'biblioteca'
  | 'escenario'
  | 'espacio'
  | 'fondo-marino'
  | 'aurora';

export type AnimationId =
  | 'saludo'
  | 'tachan'
  | 'timida'
  | 'marcha'
  | 'saltitos'
  | 'gelatina'
  | 'celebracion'
  | 'llegada'
  | 'pirueta'
  | 'baile'
  | 'reverencia'
  | 'hula'
  | 'aplausos'
  | 'emocionada'
  | 'robot'
  | 'tijeras'
  | 'dos-manos'
  | 'karate'
  | 'disco'
  | 'voltereta'
  | 'carcajada'
  | 'supersalto';

type Base = {
  name: string;
  /** Precio en monedas (si se compra). */
  price?: number;
  /** Nivel a partir del cual se puede comprar. */
  minLevel?: number;
  /** Nivel que lo regala (si no se compra). */
  giftLevel?: number;
  /** Lo tienes desde el principio. */
  starter?: boolean;
};

export type ShopItem =
  | (Base & { kind: 'accesorio'; id: AccessoryId; slot: Slot })
  | (Base & { kind: 'fondo'; id: BackgroundId })
  | (Base & { kind: 'animacion'; id: AnimationId; move: Move });

export type ItemId = ShopItem['id'];

export const CATALOG: ShopItem[] = [
  // Accesorios
  { kind: 'accesorio', id: 'gorro', slot: 'cabeza', name: 'Gorro de fiesta', price: 40 },
  { kind: 'accesorio', id: 'pajarita', slot: 'cuello', name: 'Pajarita', price: 50 },
  { kind: 'accesorio', id: 'redondas', slot: 'ojos', name: 'Gafas redondas', price: 60 },
  { kind: 'accesorio', id: 'boina', slot: 'cabeza', name: 'Boina', price: 70, minLevel: 2 },
  { kind: 'accesorio', id: 'gafas', slot: 'ojos', name: 'Gafas de sol', price: 80, minLevel: 3 },
  { kind: 'accesorio', id: 'gorra', slot: 'cabeza', name: 'Gorra', giftLevel: 4 },
  { kind: 'accesorio', id: 'corbata', slot: 'cuello', name: 'Corbata', price: 70, minLevel: 4 },
  { kind: 'accesorio', id: 'lana', slot: 'cabeza', name: 'Gorro de lana', price: 90, minLevel: 5 },
  {
    kind: 'accesorio',
    id: 'auriculares',
    slot: 'cabeza',
    name: 'Auriculares',
    price: 120,
    minLevel: 6,
  },
  { kind: 'accesorio', id: 'panuelo', slot: 'cuello', name: 'Pañuelo', giftLevel: 6 },
  {
    kind: 'accesorio',
    id: 'corazones',
    slot: 'ojos',
    name: 'Gafas de corazones',
    price: 100,
    minLevel: 7,
  },
  { kind: 'accesorio', id: 'bufanda', slot: 'cuello', name: 'Bufanda', giftLevel: 8 },
  {
    kind: 'accesorio',
    id: 'collar-flores',
    slot: 'cuello',
    name: 'Collar de flores',
    price: 130,
    minLevel: 8,
  },
  {
    kind: 'accesorio',
    id: 'perlas',
    slot: 'cuello',
    name: 'Collar de perlas',
    price: 140,
    minLevel: 9,
  },
  { kind: 'accesorio', id: 'monoculo', slot: 'ojos', name: 'Monóculo', price: 150, minLevel: 10 },
  {
    kind: 'accesorio',
    id: 'vaquero',
    slot: 'cabeza',
    name: 'Sombrero vaquero',
    price: 160,
    minLevel: 11,
  },
  {
    kind: 'accesorio',
    id: 'parche',
    slot: 'ojos',
    name: 'Parche pirata',
    price: 120,
    minLevel: 12,
  },
  { kind: 'accesorio', id: 'antifaz', slot: 'ojos', name: 'Antifaz', price: 180, minLevel: 13 },
  { kind: 'accesorio', id: 'flores', slot: 'cabeza', name: 'Corona de flores', giftLevel: 14 },
  { kind: 'accesorio', id: 'chistera', slot: 'cabeza', name: 'Chistera', giftLevel: 15 },
  {
    kind: 'accesorio',
    id: 'vikingo',
    slot: 'cabeza',
    name: 'Casco vikingo',
    price: 220,
    minLevel: 16,
  },
  { kind: 'accesorio', id: 'chef', slot: 'cabeza', name: 'Gorro de chef', giftLevel: 18 },
  {
    kind: 'accesorio',
    id: 'mago',
    slot: 'cabeza',
    name: 'Sombrero de mago',
    price: 300,
    minLevel: 20,
  },
  { kind: 'accesorio', id: 'reno', slot: 'cabeza', name: 'Cuernos de reno', giftLevel: 21 },
  { kind: 'accesorio', id: 'medalla', slot: 'cuello', name: 'Medalla', giftLevel: 26 },
  { kind: 'accesorio', id: 'corona', slot: 'cabeza', name: 'Corona', giftLevel: 31 },
  { kind: 'accesorio', id: 'aureola', slot: 'cabeza', name: 'Aureola', giftLevel: 36 },
  // Fondos
  { kind: 'fondo', id: 'papel', name: 'Papel', starter: true },
  { kind: 'fondo', id: 'atardecer', name: 'Atardecer', price: 60 },
  { kind: 'fondo', id: 'noche', name: 'Noche', giftLevel: 3 },
  { kind: 'fondo', id: 'lluvia', name: 'Lluvia', price: 70, minLevel: 4 },
  { kind: 'fondo', id: 'bosque', name: 'Bosque', price: 90, minLevel: 5 },
  { kind: 'fondo', id: 'habitacion', name: 'Habitación', price: 100, minLevel: 6 },
  { kind: 'fondo', id: 'nubes', name: 'Nubes', giftLevel: 7 },
  { kind: 'fondo', id: 'girasoles', name: 'Girasoles', price: 110, minLevel: 7 },
  { kind: 'fondo', id: 'nieve', name: 'Nieve', price: 120, minLevel: 9 },
  { kind: 'fondo', id: 'mar', name: 'Mar', giftLevel: 10 },
  { kind: 'fondo', id: 'desierto', name: 'Desierto', price: 130, minLevel: 11 },
  { kind: 'fondo', id: 'ciudad', name: 'Ciudad', price: 150, minLevel: 12 },
  { kind: 'fondo', id: 'cerezos', name: 'Cerezos', giftLevel: 13 },
  { kind: 'fondo', id: 'otono', name: 'Otoño', price: 160, minLevel: 14 },
  { kind: 'fondo', id: 'montana', name: 'Montaña', price: 180, minLevel: 15 },
  { kind: 'fondo', id: 'biblioteca', name: 'Biblioteca', giftLevel: 17 },
  { kind: 'fondo', id: 'escenario', name: 'Escenario', price: 250, minLevel: 18 },
  { kind: 'fondo', id: 'espacio', name: 'Espacio', giftLevel: 20 },
  { kind: 'fondo', id: 'fondo-marino', name: 'Fondo marino', giftLevel: 24 },
  { kind: 'fondo', id: 'aurora', name: 'Aurora', giftLevel: 41 },
  // Animaciones (gestos del tutorial y animaciones de `animations.ts`)
  { kind: 'animacion', id: 'saludo', move: 'wave', name: 'Saludo', starter: true },
  { kind: 'animacion', id: 'tachan', move: 'present', name: '¡Tachán!', price: 40 },
  { kind: 'animacion', id: 'timida', move: 'shy', name: 'Tímida', price: 45 },
  { kind: 'animacion', id: 'marcha', move: 'march', name: 'Marcha', price: 50 },
  { kind: 'animacion', id: 'saltitos', move: 'hop', name: 'Saltitos', giftLevel: 2 },
  { kind: 'animacion', id: 'gelatina', move: 'jelly', name: 'Gelatina', price: 70, minLevel: 3 },
  {
    kind: 'animacion',
    id: 'celebracion',
    move: 'cheer',
    name: 'Celebración',
    price: 80,
    minLevel: 4,
  },
  { kind: 'animacion', id: 'llegada', move: 'hello', name: 'Llega rodando', giftLevel: 5 },
  { kind: 'animacion', id: 'pirueta', move: 'spin', name: 'Pirueta', price: 90, minLevel: 5 },
  { kind: 'animacion', id: 'baile', move: 'dance', name: 'Baile', giftLevel: 6 },
  { kind: 'animacion', id: 'reverencia', move: 'bow', name: 'Reverencia', price: 100, minLevel: 7 },
  { kind: 'animacion', id: 'hula', move: 'hula', name: 'Hula hoop', price: 110, minLevel: 8 },
  { kind: 'animacion', id: 'aplausos', move: 'clap', name: 'Aplausos', giftLevel: 9 },
  {
    kind: 'animacion',
    id: 'emocionada',
    move: 'fire',
    name: 'Emocionada',
    price: 120,
    minLevel: 9,
  },
  { kind: 'animacion', id: 'robot', move: 'robot', name: 'Robot', price: 140, minLevel: 10 },
  { kind: 'animacion', id: 'tijeras', move: 'jacks', name: 'Saltos de tijera', giftLevel: 11 },
  { kind: 'animacion', id: 'dos-manos', move: 'friends', name: 'Saludo doble', giftLevel: 12 },
  { kind: 'animacion', id: 'karate', move: 'karate', name: 'Kárate', price: 170, minLevel: 14 },
  { kind: 'animacion', id: 'disco', move: 'disco', name: 'Disco', giftLevel: 16 },
  {
    kind: 'animacion',
    id: 'voltereta',
    move: 'backflip',
    name: 'Voltereta',
    price: 220,
    minLevel: 17,
  },
  { kind: 'animacion', id: 'carcajada', move: 'laugh', name: 'Carcajada', giftLevel: 19 },
  { kind: 'animacion', id: 'supersalto', move: 'trampoline', name: 'Supersalto', giftLevel: 28 },
];

export const SLOT_LABEL: Record<Slot, string> = {
  cabeza: 'Cabeza',
  ojos: 'Ojos',
  cuello: 'Cuello',
};

export function itemById(id: ItemId): ShopItem | undefined {
  return CATALOG.find((item) => item.id === id);
}

/** Lo que se regala al llegar a ese nivel. */
export function giftsAt(level: number): ShopItem[] {
  return CATALOG.filter((item) => item.giftLevel === level);
}

/** Lo que se puede comprar a partir de ese nivel (para avisarlo en el camino). */
export function unlocksAt(level: number): ShopItem[] {
  return CATALOG.filter((item) => item.minLevel === level);
}

/** Lo que tienes desde el principio. */
export const STARTER_ITEMS: ItemId[] = CATALOG.filter((item) => item.starter).map((i) => i.id);

/** Nombre del tipo, en singular, para los textos («fondo», «animación», «accesorio»). */
export const KIND_LABEL: Record<ItemKind, string> = {
  accesorio: 'disfraz',
  fondo: 'fondo',
  animacion: 'animación',
};

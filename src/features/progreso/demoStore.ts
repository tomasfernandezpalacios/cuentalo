import { useSyncExternalStore } from 'react';

import { launchCoins, type Point } from './coinBurst';
import { rankOf, tierBonus } from './ranks';
import {
  levelCoins,
  levelInfo,
  levelsGained,
  MAX_SHIELDS,
  SHIELD_PRICE,
  type Mission,
} from './model';
import {
  CATALOG,
  giftsAt,
  itemById,
  STARTER_ITEMS,
  type AccessoryId,
  type AnimationId,
  type BackgroundId,
  type ItemId,
  type ShopItem,
  type Slot,
} from './shop';

// PRUEBA (paso 1 de `docs/gamificacion/2026-11-20-analisis.md`): estado de ejemplo de la pestaña
// «Progreso», en memoria (vuelve al principio al abrir la app). Sirve para ver y tocar la
// pantalla antes de hacer las tablas y los triggers en Supabase, que darán la XP de verdad.

export type ProgressState = {
  xp: number;
  coins: number;
  /** Protectores de racha guardados. */
  shields: number;
  /** Días que ha cubierto un protector ('AAAA-MM-DD'). */
  shieldedDays: string[];
  missions: Mission[];
  owned: ItemId[];
  equipped: Partial<Record<Slot, AccessoryId>>;
  background: BackgroundId;
  animation: AnimationId;
};

const MISSIONS: Mission[] = [
  {
    id: 'hoy',
    kind: 'hoy',
    title: 'Registra algo hoy',
    icon: 'add-circle-outline',
    goal: 1,
    progress: 1,
    xp: 10,
    coins: 5,
    claimed: false,
  },
  {
    id: 'tres',
    kind: 'hoy',
    title: 'Suma en 3 contadores distintos',
    icon: 'layers-outline',
    goal: 3,
    progress: 3,
    xp: 15,
    coins: 5,
    claimed: false,
  },
  {
    id: 'semana',
    kind: 'semana',
    title: 'Registra 5 días esta semana',
    icon: 'calendar-outline',
    goal: 5,
    progress: 4,
    xp: 50,
    coins: 20,
    claimed: false,
  },
  {
    id: 'racha-7',
    kind: 'logro',
    title: 'Llega a 7 días de racha',
    icon: 'flame-outline',
    goal: 7,
    progress: 7,
    xp: 40,
    coins: 15,
    claimed: false,
  },
  {
    id: 'invitar',
    kind: 'logro',
    title: 'Invita a un amigo que se quede',
    icon: 'person-add-outline',
    goal: 1,
    progress: 0,
    xp: 100,
    coins: 40,
    claimed: false,
  },
  {
    id: 'grupo',
    kind: 'logro',
    title: 'Únete a un grupo',
    icon: 'people-outline',
    goal: 1,
    progress: 1,
    xp: 30,
    coins: 10,
    claimed: true,
  },
  {
    id: 'racha-30',
    kind: 'logro',
    title: 'Llega a 30 días de racha',
    icon: 'trophy-outline',
    goal: 30,
    progress: 12,
    xp: 150,
    coins: 60,
    claimed: false,
  },
];

const START_XP = 600;

/** Lo que tendrías con esa XP: lo del principio, lo regalado por los niveles y el gorro. */
function initialOwned(xp: number): ItemId[] {
  const level = levelInfo(xp).level;
  const gifts = CATALOG.filter((item) => item.giftLevel !== undefined && item.giftLevel <= level);
  return [...STARTER_ITEMS, ...gifts.map((item) => item.id), 'gorro'];
}

let state: ProgressState = {
  xp: START_XP,
  coins: 85,
  shields: 1,
  shieldedDays: [],
  missions: MISSIONS,
  owned: initialOwned(START_XP),
  equipped: { cabeza: 'gorro' },
  background: 'noche',
  animation: 'llegada',
};
const listeners = new Set<() => void>();

function set(next: ProgressState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProgress(): ProgressState {
  return useSyncExternalStore(subscribe, () => state);
}

/** Lo mismo fuera de React (la racha lo lee al calcularse). */
export function getProgress(): ProgressState {
  return state;
}

/** Lo que ha traído recoger una misión: niveles nuevos y lo que te han regalado en ellos. */
export type ClaimResult = {
  from: number;
  levels: number[];
  /** Monedas de los niveles nuevos (sin las de la misión). */
  levelCoins: number;
  /** Monedas extra por estrenar capítulo. */
  bonusCoins: number;
  /** Protectores de racha ganados al estrenar capítulo. */
  shields: number;
  gifts: ShopItem[];
};

/**
 * Recoger una misión cumplida: su XP y sus monedas se suman ya. Si subes de nivel, cada nivel
 * nuevo da sus monedas y sus regalos; si además estrenas capítulo, monedas extra y un protector
 * de racha (si ya tienes el máximo, su precio en monedas). Las monedas salen volando desde `from`
 * hasta el botón de monedas de la cabecera.
 */
export function claimMission(id: string, from?: Point): ClaimResult | null {
  const mission = state.missions.find((m) => m.id === id);
  if (!mission || mission.claimed || mission.progress < mission.goal) return null;
  const before = state.xp;
  const xp = before + mission.xp;
  const levels = levelsGained(before, xp);
  const gifts = levels.flatMap(giftsAt).filter((item) => !state.owned.includes(item.id));
  const fromLevels = levels.reduce((sum, level) => sum + levelCoins(level), 0);
  const newTiers = levels.filter((level) => rankOf(level).firstOfTier);
  const bonus = newTiers.map((level) => tierBonus(rankOf(level).tier.chapter));
  const shieldsWon = bonus.reduce((sum, b) => sum + b.shields, 0);
  const shields = Math.min(MAX_SHIELDS, state.shields + shieldsWon);
  const extraShields = state.shields + shieldsWon - shields;
  const bonusCoins = bonus.reduce((sum, b) => sum + b.coins, 0) + extraShields * SHIELD_PRICE;
  const coins = mission.coins + fromLevels + bonusCoins;
  set({
    ...state,
    xp,
    coins: state.coins + coins,
    shields,
    owned: [...state.owned, ...gifts.map((item) => item.id)],
    missions: state.missions.map((m) => (m.id === id ? { ...m, claimed: true } : m)),
  });
  if (from) launchCoins(from, coins);
  return {
    from: levelInfo(before).level,
    levels,
    levelCoins: fromLevels,
    bonusCoins,
    shields: shieldsWon - extraShields,
    gifts,
  };
}

/** ¿Se puede comprar ya? (Tiene precio, no es tuyo, llegas al nivel y tienes monedas.) */
export function canBuy(item: ShopItem, s: ProgressState = state): boolean {
  return (
    item.price !== undefined &&
    !s.owned.includes(item.id) &&
    levelInfo(s.xp).level >= (item.minLevel ?? 1) &&
    s.coins >= item.price
  );
}

/** Comprar algo y ponérselo (o elegirlo). */
export function buyItem(id: ItemId): boolean {
  const item = itemById(id);
  if (!item || item.price === undefined || !canBuy(item)) return false;
  set({ ...state, coins: state.coins - item.price, owned: [...state.owned, id] });
  selectItem(id);
  return true;
}

/**
 * Usar algo tuyo: un accesorio se pone (o se quita si ya lo llevaba); un fondo o una animación
 * pasan a ser los elegidos.
 */
export function selectItem(id: ItemId) {
  const item = itemById(id);
  if (!item || !state.owned.includes(id)) return;
  if (item.kind === 'accesorio') {
    const wearing = state.equipped[item.slot] === item.id;
    set({ ...state, equipped: { ...state.equipped, [item.slot]: wearing ? undefined : item.id } });
  } else if (item.kind === 'fondo') {
    set({ ...state, background: item.id });
  } else {
    set({ ...state, animation: item.id });
  }
}

/** ¿Lo lleva puesto o es el elegido? */
export function isInUse(item: ShopItem, s: ProgressState = state): boolean {
  if (item.kind === 'accesorio') return s.equipped[item.slot] === item.id;
  if (item.kind === 'fondo') return s.background === item.id;
  return s.animation === item.id;
}

/** Comprar un protector de racha (como mucho se guardan dos). */
export function buyShield(): boolean {
  if (state.shields >= MAX_SHIELDS || state.coins < SHIELD_PRICE) return false;
  set({ ...state, coins: state.coins - SHIELD_PRICE, shields: state.shields + 1 });
  return true;
}

/** Gastar protectores en esos días (los que la racha no mantuvo). */
export function spendShields(days: string[]) {
  const fresh = days.filter((day) => !state.shieldedDays.includes(day));
  if (fresh.length === 0 || fresh.length > state.shields) return;
  set({
    ...state,
    shields: state.shields - fresh.length,
    shieldedDays: [...state.shieldedDays, ...fresh],
  });
}

/** Accesorios que lleva puestos, para dibujarlos. */
export function wornAccessories(equipped: ProgressState['equipped']): AccessoryId[] {
  return Object.values(equipped).filter((id): id is AccessoryId => id !== undefined);
}

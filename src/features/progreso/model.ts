// Cuentas de la gamificación (pestaña «Progreso»): niveles y misiones. Funciones puras, con tests.
// De momento la pestaña es una prueba con datos de ejemplo (`demoStore.ts`); cuando se haga de
// verdad, la XP y las monedas las dará el servidor.

/** Último nivel. */
export const MAX_LEVEL = 100;

/**
 * XP que cuesta pasar del nivel n al n + 1: crece un 5 % por nivel (exponencial), redondeado a 5.
 * Los primeros salen en días y los últimos piden años: nivel 10 ≈ 330 XP en total, 20 ≈ 920,
 * 50 ≈ 6 000 y 100 ≈ 74 000.
 */
export function levelCost(level: number): number {
  return Math.round((30 * Math.pow(1.05, level - 1)) / 5) * 5;
}

/** XP total necesaria para llegar al nivel n (el nivel 1 empieza en 0). */
export function xpForLevel(level: number): number {
  let total = 0;
  for (let n = 1; n < level; n++) total += levelCost(n);
  return total;
}

/** Nivel con esa XP, lo que lleva dentro del nivel y lo que cuesta el nivel entero. */
export function levelInfo(xp: number) {
  let level = 1;
  while (level < MAX_LEVEL && xpForLevel(level + 1) <= xp) level += 1;
  const max = level === MAX_LEVEL;
  const into = xp - xpForLevel(level);
  const cost = max ? 0 : levelCost(level);
  return { level, into, cost, fraction: max ? 1 : into / cost, max };
}

/** XP que falta para llegar al nivel `level` (0 si ya lo tienes). */
export function xpToReach(xp: number, level: number): number {
  return Math.max(0, xpForLevel(level) - xp);
}

/** Monedas que da llegar a un nivel. */
export function levelCoins(level: number): number {
  return 10 + 2 * level;
}

/** Niveles nuevos al pasar de `before` a `after` XP (los que hay que premiar). */
export function levelsGained(before: number, after: number): number[] {
  const from = levelInfo(before).level;
  const to = levelInfo(after).level;
  return Array.from({ length: to - from }, (_, i) => from + i + 1);
}

/** Protectores de racha: protegen un día sin registro. Como mucho se guardan dos. */
export const MAX_SHIELDS = 2;
export const SHIELD_PRICE = 50;

export type MissionKind = 'hoy' | 'semana' | 'logro';

export type Mission = {
  id: string;
  kind: MissionKind;
  title: string;
  icon: string;
  goal: number;
  progress: number;
  xp: number;
  coins: number;
  claimed: boolean;
};

export type MissionStatus = 'en-curso' | 'lista' | 'recogida';

export function missionStatus(m: Mission): MissionStatus {
  if (m.claimed) return 'recogida';
  return m.progress >= m.goal ? 'lista' : 'en-curso';
}

/** Primero las que se pueden recoger, luego las que van en curso y al final las recogidas. */
export function sortMissions(missions: Mission[]): Mission[] {
  const order: Record<MissionStatus, number> = { lista: 0, 'en-curso': 1, recogida: 2 };
  return [...missions].sort((a, b) => order[missionStatus(a)] - order[missionStatus(b)]);
}

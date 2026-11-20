import { useSyncExternalStore } from 'react';

import type { ShopItem } from './shop';

// Celebración de subir de nivel (petición del usuario: «mucha más emoción»). Quien sube de nivel
// llama a `celebrateLevelUp`; `LevelUpCelebration` la dibuja a pantalla completa.

export type LevelUp = {
  id: number;
  /** Nivel que tenías. */
  from: number;
  /** Nivel al que llegas. */
  to: number;
  /** Monedas que dan los niveles nuevos. */
  coins: number;
  /** Monedas extra por estrenar capítulo (0 si no). */
  bonusCoins: number;
  /** Protectores de racha ganados al estrenar capítulo. */
  shields: number;
  /** Lo que te regalan. */
  gifts: ShopItem[];
};

let current: LevelUp | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLevelUp(): LevelUp | null {
  return useSyncExternalStore(subscribe, () => current);
}

export function celebrateLevelUp(levelUp: Omit<LevelUp, 'id'>) {
  current = { ...levelUp, id: nextId++ };
  emit();
}

export function closeLevelUp() {
  current = null;
  emit();
}

/** Piezas de confeti: ángulo, distancia, giro y color fijos para cada una (tests). */
export function confettiPieces(count: number, seed = 1) {
  // Generador sencillo con semilla: el mismo confeti cada vez, sin depender de Math.random.
  let s = seed;
  const random = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const colors = ['#E9C46A', '#F2C230', '#FFF4D6', '#E58A55', '#C99A2E', '#FFFFFF'];
  return Array.from({ length: count }, (_, i) => {
    // Hacia arriba sobre todo (de −160° a −20°), con algunas hacia los lados.
    const angle = ((-160 + random() * 140) * Math.PI) / 180;
    const distance = 120 + random() * 170;
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      fall: 260 + random() * 220,
      spin: (random() > 0.5 ? 1 : -1) * (360 + random() * 720),
      color: colors[i % colors.length] ?? '#E9C46A',
      wide: random() > 0.5,
      delay: random() * 120,
    };
  });
}

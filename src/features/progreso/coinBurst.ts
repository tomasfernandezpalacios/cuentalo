import { useEffect, useSyncExternalStore } from 'react';

// Monedas que salen volando hacia el botón de monedas de la cabecera al ganarlas (petición del
// usuario): quien las gana llama a `launchCoins` con el punto de salida; `CoinBurstLayer` las
// dibuja y avisa de cada una que llega (`useCoinArrivals`), y el botón cuenta hacia arriba.

/** Punto en coordenadas de la ventana. */
export type Point = { x: number; y: number };

export type CoinBurst = { id: number; from: Point; amount: number; coins: number };

/** Lo que tarda cada moneda: se dispersa y vuela hasta el botón. */
export const COIN_FLIGHT_MS = 850;
/** Separación entre una moneda y la siguiente. */
export const COIN_STAGGER_MS = 70;

let bursts: CoinBurst[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const arrivals = new Set<() => void>();
let measureTarget: (() => Promise<Point | null>) | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Cuántas monedas se dibujan según lo ganado: entre 4 y 10. */
export function coinsToDraw(amount: number): number {
  return Math.min(10, Math.max(4, Math.round(amount / 5)));
}

/** Lanzar monedas desde `from` (las de `amount` ya están sumadas en la cuenta). */
export function launchCoins(from: Point, amount: number) {
  if (amount <= 0) return;
  bursts = [...bursts, { id: nextId++, from, amount, coins: coinsToDraw(amount) }];
  emit();
}

export function useCoinBursts(): CoinBurst[] {
  return useSyncExternalStore(subscribe, () => bursts);
}

export function finishBurst(id: number) {
  bursts = bursts.filter((b) => b.id !== id);
  emit();
}

/** El botón de monedas dice cómo medir dónde está (su centro en la ventana). */
export function registerCoinTarget(measure: (() => Promise<Point | null>) | null) {
  measureTarget = measure;
}

export function getCoinTarget(): Promise<Point | null> {
  return measureTarget ? measureTarget() : Promise.resolve(null);
}

/** Una moneda ha llegado al botón. */
export function notifyCoinArrived() {
  arrivals.forEach((l) => l());
}

/** Escuchar las monedas que llegan (el botón da un pequeño salto con cada una). */
export function useCoinArrivals(onArrive: () => void) {
  useEffect(() => {
    arrivals.add(onArrive);
    return () => {
      arrivals.delete(onArrive);
    };
  }, [onArrive]);
}

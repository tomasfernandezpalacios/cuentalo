import { useSyncExternalStore } from 'react';
import type { AnimatedRef } from 'react-native-reanimated';

import { buildSteps, completesStep, nextIndex, type Step, type TargetId } from './steps';

// Estado del tutorial en memoria (como los avisos de AppDialog): qué pasos tocan y en cuál
// vamos. El TutorialHost lo pinta sobre la app, que queda tapada y sin tocar hasta el final.

type State = {
  steps: Step[];
  /** null = no hay tutorial en marcha. */
  index: number | null;
};

let state: State = { steps: [], index: null };
const listeners = new Set<() => void>();
/** Se llama al terminar o saltar (lo usa el arranque para marcarlo en el perfil). */
let onFinish: (() => void) | null = null;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function startTutorial(finish: () => void) {
  onFinish = finish;
  set({ steps: buildSteps(), index: 0 });
}

function finishTutorial() {
  set({ index: null });
  onFinish?.();
  onFinish = null;
}

/** Pasa al paso siguiente (o termina si era el último). */
export function nextStep() {
  if (state.index === null) return;
  const next = nextIndex(state.steps, state.index);
  if (next === null) finishTutorial();
  else set({ index: next });
}

/** «Siguiente» / «Seguir». */
export function continueTutorial() {
  nextStep();
}

/** «Saltar»: se termina y no vuelve a salir (se puede repetir desde Configuración). */
export function skipTutorial() {
  finishTutorial();
}

/**
 * Un toque (o mantener pulsado) sobre un elemento de la demostración: si es lo que pide el
 * paso, se sigue; si no, no pasa nada.
 */
export function demoGesture(target: TargetId, gesture: 'tap' | 'hold') {
  if (state.index === null) return;
  if (completesStep(state.steps[state.index], target, gesture)) nextStep();
}

export function isTutorialActive(): boolean {
  return state.index !== null;
}

export function useTutorial(): State & { step: Step | null } {
  const current = useSyncExternalStore(subscribe, () => state);
  return {
    ...current,
    step: current.index === null ? null : (current.steps[current.index] ?? null),
  };
}

// --- Elementos que se pueden iluminar ----------------------------------------------------

/** Ref de Reanimated de un elemento: se mide en el hilo de la interfaz (`measure`). */
export type TargetRef = AnimatedRef<any>;

const targets = new Map<TargetId, TargetRef>();

export function registerTarget(id: TargetId, ref: TargetRef) {
  targets.set(id, ref);
}

/** Solo se quita si sigue siendo esa vista. */
export function unregisterTarget(id: TargetId, ref: TargetRef) {
  if (targets.get(id) === ref) targets.delete(id);
}

export function getTarget(id: TargetId): TargetRef | undefined {
  return targets.get(id);
}

import { useSyncExternalStore, type ComponentRef } from 'react';
import type { View } from 'react-native';

import {
  advancesOn,
  buildSteps,
  nextIndex,
  type Step,
  type TargetId,
  type TutorialEvent,
} from './steps';

// Estado del tutorial en memoria (como los avisos de AppDialog): qué pasos tocan, en cuál
// vamos y qué elementos de la pantalla se pueden iluminar. El TutorialHost lo pinta.

type State = {
  steps: Step[];
  /** null = no hay tutorial en marcha. */
  index: number | null;
  /**
   * El paso actual está hecho y se espera un momento antes del siguiente: la barra de progreso
   * avanza con su animación (y hay confeti tras el primer registro).
   */
  completing: boolean;
  /** Qué completó el paso (para el confeti del primer +1). */
  completedBy: TutorialEvent | 'next' | null;
};

/** Lo que se espera con el paso hecho antes de enseñar el siguiente. */
export const COMPLETE_PAUSE_MS = 1100;

let state: State = { steps: [], index: null, completing: false, completedBy: null };
let pauseTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
/** Se llama al terminar o saltar (lo usa el arranque para marcarlo en el perfil). */
let onFinish: (() => void) | null = null;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startTutorial(finish: () => void) {
  onFinish = finish;
  clearPause();
  set({ steps: buildSteps(), index: 0, completing: false, completedBy: null });
}

function clearPause() {
  if (pauseTimer) clearTimeout(pauseTimer);
  pauseTimer = null;
}

function finishTutorial() {
  clearPause();
  set({ index: null, completing: false, completedBy: null });
  onFinish?.();
  onFinish = null;
}

/** Pasa al paso siguiente ya mismo (o termina si era el último). */
export function nextStep() {
  if (state.index === null) return;
  clearPause();
  const next = nextIndex(state.steps, state.index);
  if (next === null) finishTutorial();
  else set({ index: next, completing: false, completedBy: null });
}

/**
 * Da el paso por hecho: la barra avanza con su animación y, tras una pausa, sale el siguiente.
 * Mientras tanto no se puede tocar nada ni vuelve a contar otra acción.
 */
function completeStep(by: TutorialEvent | 'next') {
  if (state.index === null || state.completing) return;
  set({ completing: true, completedBy: by });
  pauseTimer = setTimeout(nextStep, COMPLETE_PAUSE_MS);
}

/** «Siguiente» en el bocadillo o en la bienvenida. */
export function continueTutorial() {
  completeStep('next');
}

/** «Saltar»: se termina y no vuelve a salir (se puede repetir desde Configuración). */
export function skipTutorial() {
  finishTutorial();
}

/** Lo avisa el código que ya existe al crear un contador o registrar algo. */
export function tutorialEvent(event: TutorialEvent) {
  if (state.index === null || state.completing) return;
  if (!advancesOn(state.steps[state.index], event)) return;
  // Al abrir el formulario o crear el contador se cambia de pantalla: sin pausa.
  if (event === 'form-opened' || event === 'counter-created') nextStep();
  else completeStep(event);
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

/** Lo que da el ref de un View (tiene measureInWindow). */
export type ViewRef = ComponentRef<typeof View>;

const targets = new Map<TargetId, ViewRef>();

export function registerTarget(id: TargetId, view: ViewRef) {
  targets.set(id, view);
}

/** Solo se quita si sigue siendo esa vista (otra puede haberse registrado con el mismo id). */
export function unregisterTarget(id: TargetId, view: ViewRef) {
  if (targets.get(id) === view) targets.delete(id);
}

export function getTarget(id: TargetId): ViewRef | undefined {
  return targets.get(id);
}

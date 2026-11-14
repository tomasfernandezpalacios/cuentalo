import { useSyncExternalStore, type ComponentRef } from 'react';
import type { View } from 'react-native';

import {
  advancesOn,
  buildSteps,
  nextIndex,
  type Step,
  type StepId,
  type TargetId,
  type TutorialEvent,
} from './steps';

// Estado del tutorial en memoria (como los avisos de AppDialog): qué pasos tocan, en cuál
// vamos y qué elementos de la pantalla se pueden iluminar. El TutorialHost lo pinta.

type State = {
  steps: Step[];
  /** null = no hay tutorial en marcha. */
  index: number | null;
  /** El contador creado en el tutorial (el que se ilumina para sumar, restar y mantener). */
  counterId: string | null;
};

let state: State = { steps: [], index: null, counterId: null };
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
  set({ steps: buildSteps(), index: 0, counterId: null });
}

function finishTutorial() {
  set({ index: null, counterId: null });
  onFinish?.();
  onFinish = null;
}

/** Pasa al paso siguiente (o termina si era el último). La barra avanza en el paso nuevo. */
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
 * Lo avisa el código que ya existe (crear, sumar, restar…) o el propio tutorial al tocar el
 * elemento iluminado. Si es la tarea del paso, se pasa al siguiente sin pausa: la barra avanza
 * y el bocadillo se desliza a su nuevo sitio.
 */
export function tutorialEvent(event: TutorialEvent, counterId?: string) {
  if (state.index === null) return;
  if (!advancesOn(state.steps[state.index], event)) return;
  if (counterId) state = { ...state, counterId };
  nextStep();
}

/** Vuelve (o salta) a un paso: p. ej. si el usuario sale del formulario a medias. */
export function goToStep(id: StepId) {
  if (state.index === null) return;
  const index = state.steps.findIndex((s) => s.id === id);
  if (index >= 0 && index !== state.index) set({ index });
}

/** Paso actual (fuera de React). */
export function currentStepId(): StepId | null {
  return state.index === null ? null : (state.steps[state.index]?.id ?? null);
}

/**
 * Avisa cada vez que cambia el paso (o termina el tutorial). Para pantallas que tienen que
 * deshacer algo al salir de un paso (p. ej. cerrar el modo selección tras enseñarlo).
 */
export function subscribeTutorial(listener: () => void): () => void {
  const unsubscribe = subscribe(listener);
  return () => {
    unsubscribe();
  };
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

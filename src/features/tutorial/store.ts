import { useSyncExternalStore } from 'react';
import type { AnimatedRef } from 'react-native-reanimated';

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
// vamos, qué está haciendo la navegación y qué elementos de la pantalla se pueden iluminar.
// El TutorialHost lo pinta. Las pantallas de la app leen solo lo que necesitan con
// `useTutorialValue`, así un cambio de paso no las vuelve a dibujar.

type State = {
  steps: Step[];
  /** null = no hay tutorial en marcha. */
  index: number | null;
  /** El contador creado en el tutorial (el que se ilumina para sumar, restar y mantener). */
  counterId: string | null;
  /** La app ha pedido que lo del paso actual se vaya ya (p. ej. mientras se crea el contador). */
  leaving: boolean;
  /** Un Stack (el formulario) está abriéndose o cerrándose. */
  stackBusy: boolean;
  /** Las páginas de las pestañas se están deslizando. */
  pagerBusy: boolean;
};

let state: State = {
  steps: [],
  index: null,
  counterId: null,
  leaving: false,
  stackBusy: false,
  pagerBusy: false,
};
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
  set({ steps: buildSteps(), index: 0, counterId: null, leaving: false });
}

function finishTutorial() {
  set({ index: null, counterId: null, leaving: false });
  onFinish?.();
  onFinish = null;
}

/** Pasa al paso siguiente (o termina si era el último). */
export function nextStep() {
  if (state.index === null) return;
  const next = nextIndex(state.steps, state.index);
  if (next === null) finishTutorial();
  else set({ index: next, leaving: false });
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
 * Lo avisa el código que ya existe (crear, sumar, restar…). Si es la tarea del paso, se pasa al
 * siguiente sin pausa.
 */
export function tutorialEvent(event: TutorialEvent, counterId?: string) {
  if (state.index === null) return;
  if (!advancesOn(state.steps[state.index], event)) return;
  if (counterId) state = { ...state, counterId };
  nextStep();
}

/**
 * La app ya ha hecho lo que pedía el paso pero el resultado tarda (crear el contador espera al
 * servidor): el bocadillo se va ya, para que la respuesta al toque sea inmediata. Si al final
 * falla, `cancelTutorialLeave` vuelve a enseñar el mismo paso.
 */
export function beginTutorialLeave(event: TutorialEvent) {
  if (state.index === null || state.leaving) return;
  if (!advancesOn(state.steps[state.index], event)) return;
  set({ leaving: true });
}

export function cancelTutorialLeave() {
  if (state.leaving) set({ leaving: false });
}

/** Vuelve (o salta) a un paso: p. ej. si el usuario sale del formulario a medias. */
export function goToStep(id: StepId) {
  if (state.index === null) return;
  const index = state.steps.findIndex((s) => s.id === id);
  if (index >= 0 && index !== state.index) set({ index, leaving: false });
}

/** Paso actual (fuera de React). */
export function currentStepId(): StepId | null {
  return state.index === null ? null : (state.steps[state.index]?.id ?? null);
}

/**
 * Avisa cada vez que cambia algo del tutorial. Para pantallas que tienen que deshacer algo al
 * salir de un paso (p. ej. cerrar el modo selección tras enseñarlo).
 */
export function subscribeTutorial(listener: () => void): () => void {
  return subscribe(listener);
}

export function isTutorialActive(): boolean {
  return state.index !== null;
}

/** Todo el estado (solo para el TutorialHost). */
export function useTutorial(): State & { step: Step | null } {
  const current = useSyncExternalStore(subscribe, () => state);
  return {
    ...current,
    step: current.index === null ? null : (current.steps[current.index] ?? null),
  };
}

/**
 * Un solo dato del tutorial (un id, un booleano…): el componente solo se vuelve a dibujar cuando
 * cambia ese dato, no en cada paso.
 */
export function useTutorialValue<T extends string | number | boolean | null>(
  select: (state: State, step: Step | null) => T,
): T {
  return useSyncExternalStore(subscribe, () =>
    select(state, state.index === null ? null : (state.steps[state.index] ?? null)),
  );
}

// --- Transiciones de la navegación ---------------------------------------------------------
// Las medidas de los elementos salen del árbol de layout, que no ve las animaciones nativas (el
// Stack que abre el formulario, el deslizador de las pestañas): por eso el tutorial no intenta
// adivinar si la pantalla se mueve midiendo, sino que espera a que la navegación avise.

export function setStackBusy(busy: boolean) {
  if (state.stackBusy !== busy) set({ stackBusy: busy });
}

/** Cómo está la navegación ahora mismo (fuera de React). */
export function getNavBusy(): { stack: boolean; pager: boolean } {
  return { stack: state.stackBusy, pager: state.pagerBusy };
}

export function setPagerBusy(busy: boolean) {
  if (state.pagerBusy !== busy) set({ pagerBusy: busy });
}

// --- Elementos que se pueden iluminar ----------------------------------------------------

/** Ref de Reanimated de un elemento: se mide en el hilo de la interfaz (`measure`). */
export type TargetRef = AnimatedRef<any>;

const targets = new Map<TargetId, TargetRef>();
const targetListeners = new Set<() => void>();

function targetsChanged() {
  targetListeners.forEach((listener) => listener());
}

export function registerTarget(id: TargetId, ref: TargetRef) {
  targets.set(id, ref);
  targetsChanged();
}

/** Solo se quita si sigue siendo esa vista (otra puede haberse registrado con el mismo id). */
export function unregisterTarget(id: TargetId, ref: TargetRef) {
  if (targets.get(id) !== ref) return;
  targets.delete(id);
  targetsChanged();
}

export function getTarget(id: TargetId): TargetRef | undefined {
  return targets.get(id);
}

/** Avisa cuando se monta o se desmonta algún elemento iluminable. */
export function subscribeTargets(listener: () => void): () => void {
  targetListeners.add(listener);
  return () => {
    targetListeners.delete(listener);
  };
}

import { AccessibilityInfo } from 'react-native';
import type Animated from 'react-native-reanimated';
import type { AnimatedRef } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import { tick } from './animations';
import type { Edges } from './layout';
import { nextPhase, type Phase, type PhaseEvent } from './machine';
import {
  createValues,
  enterWorklet,
  leaveWorklet,
  showVeil,
  skipWorklet,
  stopAll,
  type Values,
} from './motion';
import { closesBetween, letsTouchTarget, SCENES, stepKind, targetShape, type Step } from './steps';
import { getTarget, nextStep, skipTutorial } from './store';

/** Lo que está a la vista con el paso «activo»: dónde está el hueco y si faltaba el elemento. */
export type Active = { edges: Edges; missing: boolean };

/** Lo que dibuja el Coach (solo cambia una o dos veces por paso). */
export type CoachView = {
  /** Paso cuyo texto lleva el bocadillo (y cuya pantalla de la demo se ve). */
  content: { step: Step; index: number } | null;
  /** Hasta dónde llega la barra de progreso (avanza al aparecer el paso). */
  progress: number;
  /** Solo con el paso a la vista: entonces se puede tocar el hueco y el bocadillo. */
  active: Active | null;
};

type Timer = ReturnType<typeof setTimeout>;

/**
 * Director del tutorial: lleva la máquina de estados de cada paso (machine.ts) fuera de React y
 * lanza sus animaciones en el hilo de la interfaz (motion.ts). El tutorial es una demostración
 * fija: no espera a la base de datos ni a la navegación, solo a que termine cada animación. Un
 * paso nuevo invalida (`run`) todo lo del anterior.
 */
export class Director {
  readonly values: Values;
  private view: CoachView = { content: null, progress: 0, active: null };
  private listeners = new Set<() => void>();
  private layer: AnimatedRef<Animated.View> | null = null;
  private bubble: AnimatedRef<Animated.View> | null = null;

  private run = 0;
  private phase: Phase = 'waiting';
  /** Último paso que se llegó a enseñar (para saber si hay que cerrar el hueco al dejarlo). */
  private shown: Step | null = null;
  private step: Step | null = null;
  private index = 0;
  /** Paso que espera a que su texto esté dibujado para entrar. */
  private waiting: Step | null = null;
  private insets = { top: 0, bottom: 0 };
  private timers: Timer[] = [];

  constructor(width: number, height: number) {
    this.values = createValues(width, height);
  }

  // --- Para el componente ------------------------------------------------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getView = () => this.view;

  private setView(patch: Partial<CoachView>) {
    this.view = { ...this.view, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  /** Al montarse la capa: aparece el velo. */
  mount(layer: AnimatedRef<Animated.View>, bubble: AnimatedRef<Animated.View>) {
    this.layer = layer;
    this.bubble = bubble;
    scheduleOnUI(showVeil, this.values);
  }

  dispose() {
    // Si se vuelve a montar, el paso se enseña otra vez desde el principio.
    this.step = null;
    this.phase = 'waiting';
    this.clearTimers();
    scheduleOnUI(stopAll, this.values);
  }

  setInsets(top: number, bottom: number) {
    this.insets = { top, bottom };
  }

  /** Paso actual: empieza su secuencia. */
  goTo(step: Step, index: number) {
    if (step === this.step && index === this.index) return;
    this.step = step;
    this.index = index;

    // Fase «leaving»: lo del paso anterior se va (y el hueco se cierra si cambia la pantalla).
    const run = ++this.run;
    this.clearTimers();
    this.dispatch('leave');
    this.waiting = null;
    if (this.view.active) this.setView({ active: null });
    const close = closesBetween(this.shown, step);
    scheduleOnUI(leaveWorklet, this.values, run, close, this.onLeft);
  }

  /** El Coach ya ha dibujado el texto nuevo del bocadillo: se puede medir y entrar. */
  contentCommitted(content: CoachView['content']) {
    const step = this.waiting;
    if (!content || !step || content.step !== step || this.phase !== 'waiting') return;
    this.enter(step);
  }

  /** «Saltar»: todo se funde y se termina. */
  skip = () => {
    const run = ++this.run;
    this.clearTimers();
    this.setView({ active: null });
    scheduleOnUI(skipWorklet, this.values, run, skipTutorial);
  };

  // --- Fases ------------------------------------------------------------------------------

  private dispatch(event: PhaseEvent) {
    this.phase = nextPhase(this.phase, event);
  }

  /** Fin de «leaving» → «waiting»: con todo apagado, el texto nuevo del bocadillo. */
  private onLeft = (run: number) => {
    if (run !== this.run || !this.step) return;
    this.dispatch('left');
    const step = this.step;
    this.waiting = step;
    this.setView({ content: { step, index: this.index } });
  };

  /** «waiting» → «entering»: otra pantalla si toca, una medida y un único movimiento. */
  private enter(step: Step) {
    if (!this.layer || !this.bubble) return;
    this.dispatch('ready');
    const run = this.run;
    const index = this.index;
    const kind = stepKind(step);
    const ref = kind === 'spotlight' && step.target ? (getTarget(step.target) ?? null) : null;
    if (index > 0) tick();

    const onEntered = (doneRun: number, edges: Edges, wasMissing: boolean) => {
      if (doneRun !== this.run) return;
      this.dispatch('entered');
      this.shown = step;
      this.setView({
        active: { edges, missing: wasMissing || (kind === 'spotlight' && !ref) },
        progress: index,
      });
      if (kind === 'spotlight') {
        AccessibilityInfo.announceForAccessibility(`${step.title}. ${step.text}`);
      } else if (kind === 'banner') {
        AccessibilityInfo.announceForAccessibility(step.title);
        this.timers.push(
          setTimeout(() => {
            if (doneRun === this.run) nextStep();
          }, step.autoAdvanceMs ?? 2000),
        );
      }
    };

    scheduleOnUI(enterWorklet, this.values, {
      run,
      target: ref,
      shape: targetShape(step.target),
      layer: this.layer,
      bubbleRef: this.bubble,
      insetTop: this.insets.top,
      insetBottom: this.insets.bottom,
      show: kind === 'spotlight' ? 'bubble' : kind === 'banner' ? 'banner' : 'nothing',
      ring: kind === 'spotlight' && letsTouchTarget(step),
      scene: SCENES.indexOf(step.scene),
      onEntered,
    });
  }

  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}

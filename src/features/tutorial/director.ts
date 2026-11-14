import { router } from 'expo-router';
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
  MISSING_MS,
  PAGER_SAFETY_MS,
  showVeil,
  skipWorklet,
  STACK_SAFETY_MS,
  stopAll,
  type Values,
} from './motion';
import {
  advancesOnScreen,
  closesBetween,
  isTabScreen,
  isWholeScreen,
  letsTouchTarget,
  navigationFor,
  readyToEnter,
  stepKind,
  stepScreen,
  type Step,
} from './steps';
import {
  getNavBusy,
  getTarget,
  goToStep,
  nextStep,
  setPagerBusy,
  setStackBusy,
  skipTutorial,
  subscribeTargets,
  subscribeTutorial,
} from './store';

/** Lo que está a la vista con el paso «activo»: dónde está el hueco y si faltaba el elemento. */
export type Active = { edges: Edges; missing: boolean };

/** Lo que dibuja el Coach (solo cambia una o dos veces por paso). */
export type CoachView = {
  /** Paso cuyo texto lleva el bocadillo (cambia con todo apagado, antes de medir). */
  content: { step: Step; index: number } | null;
  /** Hasta dónde llega la barra de progreso (avanza al aparecer el paso). */
  progress: number;
  /** Solo con el paso a la vista: entonces se puede tocar el hueco y el bocadillo. */
  active: Active | null;
};

type Timer = ReturnType<typeof setTimeout>;

/**
 * Director del tutorial: lleva la máquina de estados de cada paso (machine.ts) fuera de React.
 * Recibe el paso actual y dónde está la app (ruta, transiciones, elementos montados), decide
 * cuándo empieza cada fase y lanza sus animaciones en el hilo de la interfaz (motion.ts). Cada
 * fase empieza cuando avisa la anterior; un paso nuevo invalida (`run`) todo lo del anterior.
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
  private leaving = false;
  /** Paso que espera (fase «waiting») a que su pantalla esté lista. */
  private waiting: Step | null = null;
  /** El texto del bocadillo del paso que espera ya está dibujado (se puede medir su alto). */
  private contentReady = false;
  private pathname = '/';
  private insets = { top: 0, bottom: 0 };
  private timers: Timer[] = [];
  private stackTimer: Timer | null = null;
  private pagerTimer: Timer | null = null;
  private fallbackTimer: Timer | null = null;
  private unsubscribe: (() => void)[] = [];

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

  /** Al montarse la capa: empieza a escuchar a la app y aparece el velo. */
  mount(layer: AnimatedRef<Animated.View>, bubble: AnimatedRef<Animated.View>) {
    this.layer = layer;
    this.bubble = bubble;
    this.unsubscribe = [
      subscribeTargets(() => this.check()),
      subscribeTutorial(() => this.onStoreChange()),
    ];
    scheduleOnUI(showVeil, this.values);
  }

  dispose() {
    // Si se vuelve a montar, el paso se enseña otra vez desde el principio.
    this.step = null;
    this.phase = 'waiting';
    this.unsubscribe.forEach((off) => off());
    this.unsubscribe = [];
    this.clearTimers();
    this.clearSafety();
    scheduleOnUI(stopAll, this.values);
  }

  /** Dónde está la app: la ruta y los márgenes seguros. */
  setEnvironment(pathname: string, top: number, bottom: number) {
    const before = this.pathname;
    this.pathname = pathname;
    this.insets = { top, bottom };
    if (before !== pathname) {
      // Cambiar de pestaña desliza las páginas: hasta que se asientan (`swipeEnd`, en el layout
      // de las pestañas) no se ilumina nada.
      if (isTabScreen(before) && isTabScreen(pathname)) setPagerBusy(true);
      // Pasos de pestaña: al llegar a la pantalla (tocando la pestaña iluminada), se sigue.
      if (this.step && advancesOnScreen(this.step, pathname)) {
        nextStep();
        return;
      }
    }
    this.watchFallback();
    this.check();
  }

  /** Paso actual (o la petición de irse ya, mientras se crea el contador). */
  goTo(step: Step, index: number, leaving: boolean) {
    if (step === this.step && index === this.index && leaving === this.leaving) return;
    this.step = step;
    this.index = index;
    this.leaving = leaving;

    // Fase «leaving»: lo del paso anterior se va (y el hueco se cierra si se cambia de pantalla).
    const run = ++this.run;
    this.clearTimers();
    this.dispatch('leave');
    this.waiting = null;
    this.contentReady = false;
    if (this.view.active) this.setView({ active: null });
    const close = closesBetween(this.shown, leaving ? null : step);
    scheduleOnUI(leaveWorklet, this.values, run, close, this.onLeft);
    this.watchFallback();
  }

  /** El Coach ya ha dibujado el texto nuevo del bocadillo. */
  contentCommitted(content: CoachView['content']) {
    if (!content || content.step !== this.waiting) return;
    this.contentReady = true;
    this.check();
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

  /** Fin de «leaving» → «waiting»: todo apagado y quieto. */
  private onLeft = (run: number) => {
    if (run !== this.run || !this.step) return;
    this.dispatch('left');
    // Pedido irse sin paso nuevo todavía: se espera, apagado, a que llegue.
    if (this.leaving) return;
    const step = this.step;
    this.waiting = step;
    // Con todo quieto: el texto nuevo del bocadillo (se mide cuando ya está dibujado) y, si
    // hace falta, la pantalla del paso.
    this.setView({ content: { step, index: this.index } });
    const destination = navigationFor(step, this.pathname);
    if (destination) router.navigate(destination);
    // Nunca se queda atascado: si el elemento no llega, el paso se explica igual.
    this.timers.push(
      setTimeout(() => {
        if (run === this.run && this.phase === 'waiting') this.enter(step, true);
      }, MISSING_MS),
    );
  };

  /** ¿Ya se puede enseñar el paso que espera? Se mira cada vez que cambia algo de la app. */
  private check() {
    const step = this.waiting;
    if (!step || this.phase !== 'waiting' || !this.contentReady) return;
    const busy = getNavBusy();
    const targetMounted = step.target ? getTarget(step.target) !== undefined : true;
    const ready = readyToEnter(step, {
      pathname: this.pathname,
      stackBusy: busy.stack,
      pagerBusy: busy.pager,
      targetMounted,
    });
    if (ready) this.enter(step, false);
  }

  /** «waiting» → «entering»: una medida y un único movimiento (en el hilo de la interfaz). */
  private enter(step: Step, missing: boolean) {
    if (!this.layer || !this.bubble) return;
    this.dispatch('ready');
    const run = this.run;
    const index = this.index;
    const kind = stepKind(step);
    const ref = kind === 'spotlight' && !missing && step.target ? getTarget(step.target) : null;
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
      target: ref ?? null,
      whole: isWholeScreen(step.target),
      layer: this.layer,
      bubbleRef: this.bubble,
      insetTop: this.insets.top,
      insetBottom: this.insets.bottom,
      show: kind === 'spotlight' ? 'bubble' : kind === 'banner' ? 'banner' : 'nothing',
      ring: kind === 'spotlight' && letsTouchTarget(step),
      onEntered,
    });
  }

  // --- La app -----------------------------------------------------------------------------

  private onStoreChange() {
    const busy = getNavBusy();
    // Por si la navegación no avisa del final de una transición: nunca se espera para siempre.
    if (busy.stack && !this.stackTimer) {
      this.stackTimer = setTimeout(() => {
        this.stackTimer = null;
        setStackBusy(false);
      }, STACK_SAFETY_MS);
    } else if (!busy.stack && this.stackTimer) {
      clearTimeout(this.stackTimer);
      this.stackTimer = null;
    }
    if (busy.pager && !this.pagerTimer) {
      this.pagerTimer = setTimeout(() => {
        this.pagerTimer = null;
        setPagerBusy(false);
      }, PAGER_SAFETY_MS);
    } else if (!busy.pager && this.pagerTimer) {
      clearTimeout(this.pagerTimer);
      this.pagerTimer = null;
    }
    this.watchFallback();
    this.check();
  }

  /**
   * Si el usuario sale a medias de la pantalla del paso (vuelve atrás desde el formulario), el
   * tutorial vuelve al paso desde el que se llega a ella, cuando la pantalla ya se ha cerrado.
   */
  private watchFallback() {
    const step = this.step;
    const away =
      step?.fallback !== undefined && !getNavBusy().stack && this.pathname !== stepScreen(step);
    if (!away) {
      if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
      return;
    }
    if (this.fallbackTimer) return;
    const fallback = step.fallback;
    this.fallbackTimer = setTimeout(() => {
      this.fallbackTimer = null;
      if (fallback) goToStep(fallback);
    }, 250);
  }

  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  private clearSafety() {
    [this.stackTimer, this.pagerTimer, this.fallbackTimer].forEach((t) => t && clearTimeout(t));
    this.stackTimer = null;
    this.pagerTimer = null;
    this.fallbackTimer = null;
  }
}

import Animated, {
  cancelAnimation,
  Easing,
  makeMutable,
  measure,
  withDelay,
  withRepeat,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  closeAt,
  closedHole,
  type Edges,
  glideDuration,
  holeFor,
  holeInside,
  isClosed,
  isVisibleIn,
  movedEnough,
  placeBubble,
  type Rect,
  SIDE_MARGIN,
} from './layout';
import { SCENES } from './steps';
import type { TargetRef } from './store';

// Todo lo que se mueve en el tutorial y cómo se encadena, en el hilo de la interfaz
// (Reanimated). JavaScript solo dice cuándo empieza cada fase (ver director.ts); la medida del
// elemento, el deslizamiento del foco y la aparición del bocadillo van seguidos aquí, sin volver
// a JavaScript entre medias, así nada se para aunque la app esté ocupada.

export const VEIL_COLOR = '#050508';
export const VEIL_OPACITY = 0.72;
/** Lo que tarda en irse el bocadillo. */
const LEAVE_MS = 160;
/** Lo que tarda el hueco en cerrarse al cambiar de pantalla (iris). */
const CLOSE_MS = 260;
/** Lo que tarda en aparecer el bocadillo (y el rótulo). */
const APPEAR_MS = 240;
/** Fundido del velo al empezar y al saltar. */
export const VEIL_IN_MS = 420;
const SKIP_MS = 240;
/** El bocadillo aparece subiendo esto. */
const APPEAR_RISE = 10;
/** Dos medidas iguales seguidas (la demostración es fija: basta para asegurarse). */
const STABLE_FRAMES = 1;
/** Como mucho se espera esto a la medida; después se usa lo que haya. */
const SETTLE_TIMEOUT_MS = 600;
/** Fundido entre dos pantallas de la demostración (con todo apagado). */
const SCENE_MS = 220;
export const CARET = 14;
/** Solape entre las piezas del velo. */
export const SEAM = 1;

/** Movimiento del foco: arranca y frena con suavidad. */
const GLIDE_EASING = Easing.bezier(0.45, 0, 0.2, 1);
/** Apariciones: rápidas al principio y muy suaves al final. */
export const OUT_EASING = Easing.bezier(0.22, 1, 0.36, 1);
/** Salidas: empiezan suaves y se van deprisa. */
const IN_EASING = Easing.bezier(0.4, 0, 1, 1);

/** Todos los valores que se animan (viven en el hilo de la interfaz). */
export type Values = {
  /** Paso en curso: cada vez que cambia, lo que esté en marcha del anterior se para. */
  run: SharedValue<number>;
  left: SharedValue<number>;
  top: SharedValue<number>;
  right: SharedValue<number>;
  bottom: SharedValue<number>;
  veil: SharedValue<number>;
  bubble: SharedValue<number>;
  bubbleY: SharedValue<number>;
  caretX: SharedValue<number>;
  /** 0 sin piquito, 1 arriba (bocadillo debajo del foco), 2 abajo. */
  caretSide: SharedValue<number>;
  ring: SharedValue<number>;
  pulse: SharedValue<number>;
  ringX: SharedValue<number>;
  ringY: SharedValue<number>;
  ringW: SharedValue<number>;
  ringH: SharedValue<number>;
  banner: SharedValue<number>;
  /** Opacidad de cada pantalla de la demostración (en el orden de SCENES). */
  scenes: SharedValue<number>[];
};

/**
 * Los valores se crean fuera de React (`makeMutable`): los maneja el director del tutorial, no un
 * componente, y así ningún render los toca.
 */
export function createValues(width: number, height: number): Values {
  const center = closedHole(width / 2, height / 2);
  return {
    run: makeMutable(0),
    left: makeMutable(center.left),
    top: makeMutable(center.top),
    right: makeMutable(center.right),
    bottom: makeMutable(center.bottom),
    veil: makeMutable(0),
    bubble: makeMutable(0),
    bubbleY: makeMutable(0),
    caretX: makeMutable(0),
    caretSide: makeMutable(0),
    ring: makeMutable(0),
    pulse: makeMutable(0),
    ringX: makeMutable(0),
    ringY: makeMutable(0),
    ringW: makeMutable(0),
    ringH: makeMutable(0),
    banner: makeMutable(0),
    scenes: SCENES.map((_, i) => makeMutable(i === 0 ? 1 : 0)),
  };
}

/** El velo aparece (al empezar el tutorial) con el hueco cerrado en el centro. */
export function showVeil(v: Values) {
  'worklet';
  v.veil.value = withTiming(1, { duration: VEIL_IN_MS, easing: OUT_EASING });
}

/** Al terminar: lo que quede en marcha se para. */
export function stopAll(v: Values) {
  'worklet';
  v.run.value = -1;
  cancelAnimation(v.pulse);
}

// --- Lo que corre en el hilo de la interfaz -------------------------------------------------

function currentEdges(v: Values): Edges {
  'worklet';
  return { left: v.left.value, top: v.top.value, right: v.right.value, bottom: v.bottom.value };
}

function animateEdges(
  v: Values,
  to: Edges,
  duration: number,
  easing: typeof GLIDE_EASING,
  done: (finished?: boolean) => void,
) {
  'worklet';
  const config = { duration, easing };
  v.left.value = withTiming(to.left, config);
  v.top.value = withTiming(to.top, config);
  v.right.value = withTiming(to.right, config);
  v.bottom.value = withTiming(to.bottom, config, done);
}

/**
 * Fase «leaving»: se van el bocadillo, el anillo y el rótulo y, después (nunca a la vez), si toca,
 * el hueco se cierra sobre su centro. Al terminar avisa a JavaScript (`onLeft`).
 */
export function leaveWorklet(
  v: Values,
  run: number,
  close: boolean,
  onLeft: (run: number) => void,
) {
  'worklet';
  // Desde aquí, lo que quede en marcha del paso anterior (medidas, avisos) ya no vale.
  v.run.value = run;
  cancelAnimation(v.pulse);
  const closeHole = () => {
    if (v.run.value !== run) return;
    const edges = currentEdges(v);
    if (!close || isClosed(edges)) {
      scheduleOnRN(onLeft, run);
      return;
    }
    animateEdges(v, closeAt(edges), CLOSE_MS, IN_EASING, (finished) => {
      if (finished && v.run.value === run) scheduleOnRN(onLeft, run);
    });
  };
  const visible = v.bubble.value > 0.01 || v.ring.value > 0.01 || v.banner.value > 0.01;
  if (!visible) {
    closeHole();
    return;
  }
  const config = { duration: LEAVE_MS, easing: IN_EASING };
  v.ring.value = withTiming(0, config);
  v.banner.value = withTiming(0, config);
  v.bubble.value = withTiming(0, config, (finished) => {
    if (finished) closeHole();
  });
}

export type EnterArgs = {
  run: number;
  /** Elemento a iluminar (null: nada, el hueco se queda cerrado en el centro). */
  target: TargetRef | null;
  /** El elemento es una pantalla entera: el hueco va por dentro. */
  whole: boolean;
  layer: AnimatedRef<Animated.View>;
  bubbleRef: AnimatedRef<Animated.View>;
  insetTop: number;
  insetBottom: number;
  /** Qué aparece al llegar el foco. */
  show: 'bubble' | 'banner' | 'nothing';
  /** Anillo que late alrededor de lo que hay que tocar. */
  ring: boolean;
  /** Pantalla de la demostración del paso (índice en SCENES). */
  scene: number;
  onEntered: (run: number, edges: Edges, missing: boolean) => void;
};

/**
 * Fases «entering» → «active»: mide el elemento (en el mismo hilo que lo dibuja, sin idas y
 * vueltas a JavaScript) hasta verlo quieto unos fotogramas, desliza el foco hasta él en un único
 * movimiento y, al llegar, hace aparecer el bocadillo y el anillo.
 */
export function enterWorklet(v: Values, a: EnterArgs) {
  'worklet';
  const startedAt = Date.now();
  let last: Rect | null = null;
  let stable = 0;

  const go = (layerWidth: number, layerHeight: number, rect: Rect | null) => {
    const screen = {
      width: layerWidth,
      height: layerHeight,
      top: a.insetTop,
      bottom: a.insetBottom,
    };
    const missing = a.target !== null && rect === null;
    const to = rect
      ? a.whole
        ? holeInside(rect)
        : holeFor(rect)
      : closedHole(layerWidth / 2, layerHeight / 2);
    const from = currentEdges(v);

    const appear = () => {
      if (v.run.value !== a.run) return;
      if (a.show === 'banner') {
        v.banner.value = withTiming(1, { duration: APPEAR_MS + 80, easing: OUT_EASING });
      } else if (a.show === 'bubble') {
        const bubble = measure(a.bubbleRef);
        const place = placeBubble(to, bubble ? bubble.height : 0, screen);
        v.caretX.value = place.caretX - SIDE_MARGIN - CARET / 2;
        v.caretSide.value = place.caret ? (place.placement === 'below' ? 1 : 2) : 0;
        v.bubbleY.value = place.top + APPEAR_RISE;
        v.bubbleY.value = withTiming(place.top, { duration: APPEAR_MS, easing: OUT_EASING });
        v.bubble.value = withTiming(1, { duration: APPEAR_MS, easing: OUT_EASING });
      }
      if (a.ring && !missing) {
        v.ringX.value = to.left - 3;
        v.ringY.value = to.top - 3;
        v.ringW.value = to.right - to.left + 6;
        v.ringH.value = to.bottom - to.top + 6;
        v.pulse.value = 0;
        v.ring.value = withDelay(80, withTiming(1, { duration: 220, easing: OUT_EASING }));
        v.pulse.value = withDelay(
          300,
          withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true),
        );
      }
      scheduleOnRN(a.onEntered, a.run, to, missing);
    };

    const still =
      Math.abs(from.left - to.left) < 0.5 &&
      Math.abs(from.top - to.top) < 0.5 &&
      Math.abs(from.right - to.right) < 0.5 &&
      Math.abs(from.bottom - to.bottom) < 0.5;
    if (still) {
      appear();
      return;
    }
    animateEdges(v, to, glideDuration(from, to), GLIDE_EASING, (finished) => {
      if (finished) appear();
    });
  };

  const frame = () => {
    if (v.run.value !== a.run) return;
    const layer = measure(a.layer);
    if (!layer) {
      if (Date.now() - startedAt < SETTLE_TIMEOUT_MS) requestAnimationFrame(frame);
      return;
    }
    if (!a.target) {
      go(layer.width, layer.height, null);
      return;
    }
    const m = measure(a.target);
    const rect: Rect | null = m
      ? { x: m.pageX - layer.pageX, y: m.pageY - layer.pageY, width: m.width, height: m.height }
      : null;
    const visible = rect !== null && isVisibleIn(rect, layer.width, layer.height);
    if (Date.now() - startedAt >= SETTLE_TIMEOUT_MS) {
      go(layer.width, layer.height, visible ? rect : null);
      return;
    }
    if (!visible || !rect) {
      last = null;
      stable = 0;
    } else if (last === null || movedEnough(last, rect)) {
      last = rect;
      stable = 0;
    } else {
      stable += 1;
      if (stable >= STABLE_FRAMES) {
        go(layer.width, layer.height, rect);
        return;
      }
    }
    requestAnimationFrame(frame);
  };

  // Si el paso es en otra pantalla, primero se funde (con todo apagado) y después se mide.
  let changes = false;
  for (let i = 0; i < v.scenes.length; i++) {
    const want = i === a.scene ? 1 : 0;
    if (Math.abs(v.scenes[i]!.value - want) > 0.001) changes = true;
  }
  if (!changes) {
    frame();
    return;
  }
  const config = { duration: SCENE_MS, easing: Easing.inOut(Easing.quad) };
  for (let i = 0; i < v.scenes.length; i++) {
    if (i === a.scene) {
      v.scenes[i]!.value = withTiming(1, config, (finished) => {
        if (finished && v.run.value === a.run) frame();
      });
    } else {
      v.scenes[i]!.value = withTiming(0, config);
    }
  }
}

/** «Saltar»: todo se funde a la vez y se termina. */
export function skipWorklet(v: Values, run: number, done: () => void) {
  'worklet';
  v.run.value = run;
  cancelAnimation(v.pulse);
  const config = { duration: SKIP_MS, easing: IN_EASING };
  v.bubble.value = withTiming(0, config);
  v.ring.value = withTiming(0, config);
  v.banner.value = withTiming(0, config);
  v.veil.value = withTiming(0, config, () => scheduleOnRN(done));
}

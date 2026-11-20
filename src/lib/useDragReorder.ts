import * as Haptics from 'expo-haptics';
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
} from 'react-native';

import { getSettings } from '@/features/configuracion/settings';

import {
  dropIndex,
  edgeSpeed,
  gridDropIndex,
  moveItem,
  type Point,
  type Size,
  slotPositions,
} from './reorder';

// Reordenar una lista (una columna) o una cuadrícula manteniendo pulsado y arrastrando, sin
// librerías de gestos.
//
// * Mantener pulsado un elemento lo «levanta» (crece un poco).
// * Al mover el dedo, la capa que envuelve la lista se queda con el gesto: el elemento sigue al
//   dedo y los demás se deslizan a su nuevo hueco.
// * Al soltar, el elemento se desliza hasta su hueco y solo entonces se guarda el nuevo orden;
//   cada uno se queda donde se ve hasta que llega ese orden y todo vuelve a 0 antes de pintar
//   (useLayoutEffect): ni saltos ni un fotograma con el orden viejo.
// * Si se suelta sin mover, vuelve a su sitio y avisa (onHold).
//
// Las animaciones van en el hilo de JS (useNativeDriver: false) a propósito: así poner un valor
// a mano (setValue) se aplica en el mismo fotograma que el nuevo orden, sin parpadeos.

const MOVE_MS = 200;
const DROP_MS = 170;
const LIFT_SCALE = 1.04;

type Drag = { key: string; from: number; startX: number; startY: number; granted: boolean };

type Handlers = {
  /** El dedo se ha movido (dx, dy) desde donde empezó. */
  move: (dx: number, dy: number) => void;
  /** Empieza el arrastre de verdad (el dedo se ha movido). */
  grant: () => void;
  /** Un fotograma del desplazamiento automático. */
  tick: () => void;
  finish: () => void;
};

/**
 * Estado del arrastre, fuera de React (lo leen y cambian los manejadores del gesto). Una
 * función que crea el objeto: así los cambios no son «mutar estado» de React.
 */
function createDragState() {
  let drag: Drag | null = null;
  let handlers: Handlers = { move: () => {}, grant: () => {}, tick: () => {}, finish: () => {} };
  let target = 0;
  const sizes = new Map<string, Size>();
  const offsets = new Map<string, Animated.ValueXY>();
  return {
    handlers: () => handlers,
    setHandlers: (value: Handlers) => {
      handlers = value;
    },
    get: () => drag,
    set: (value: Drag | null) => {
      drag = value;
    },
    target: () => target,
    setTarget: (value: number) => {
      target = value;
    },
    size: (key: string) => sizes.get(key) ?? { width: 0, height: 0 },
    setSize: (key: string, value: Size) => sizes.set(key, value),
    offset: (key: string) => {
      let value = offsets.get(key);
      if (!value) {
        value = new Animated.ValueXY({ x: 0, y: 0 });
        offsets.set(key, value);
      }
      return value;
    },
  };
}

type Options = {
  keys: string[];
  onReorder: (keys: string[]) => void;
  /** Hueco entre elementos (en cuadrícula, el mismo en horizontal y en vertical). */
  gap?: number;
  /** Columnas: 1 = lista (por defecto); 2 o más = cuadrícula de celdas iguales. */
  columns?: number;
  /** Empieza a moverse (p. ej. para bloquear el desplazamiento de la lista). */
  onDragStart?: (key: string) => void;
  /** Se mantuvo pulsado y se soltó sin moverlo (p. ej. para entrar en el modo selección). */
  onHold?: (key: string) => void;
  /**
   * Lista desplazable que la contiene: al llevar el elemento cerca del borde de arriba o de abajo,
   * la lista se desplaza sola (más rápido cuanto más cerca del borde) y el elemento sigue al dedo.
   */
  autoScroll?: AutoScroll;
  /**
   * Vista que envuelve la pantalla: si se da, mientras se arrastra se dibuja una copia del
   * elemento encima de todo (`overlay`), fuera de la lista, y el original se esconde. Así el
   * elemento nunca parpadea al desplazarse la lista sola (Android deja de dibujar lo que, según
   * su sitio en la lista, queda fuera de la pantalla, aunque se vea movido bajo el dedo).
   */
  overlayRoot?: RefObject<Measurable | null>;
};

export type AutoScroll = {
  /** La vista desplazable (ScrollView). */
  ref: RefObject<ScrollableView | null>;
  /** Desplazamiento actual de la lista. */
  offset: () => number;
  /** Mínimo y máximo hasta donde se puede desplazar. */
  minOffset?: () => number;
  maxOffset: () => number;
  /** Lo que tapa la parte de abajo de la lista (p. ej. la barra de pestañas flotante). */
  bottomInset?: number;
};

type ScrollableView = Measurable & {
  scrollTo: (options: { y: number; animated?: boolean }) => void;
};

export type Measurable = {
  measure: (
    callback: (
      x: number,
      y: number,
      width: number,
      height: number,
      pageX: number,
      pageY: number,
    ) => void,
  ) => void;
};

/** Estado del desplazamiento automático durante un arrastre (fuera de React). */
type ScrollDrag = {
  start: number;
  current: number;
  top: number;
  bottom: number;
  fingerX: number;
  fingerY: number;
  frame: number | null;
};

function slide(value: Animated.ValueXY | Animated.Value, toValue: Point | number, ms: number) {
  return Animated.timing(value, {
    toValue,
    duration: ms,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: false,
  });
}

export function useDragReorder({
  keys,
  onReorder,
  gap = 0,
  columns = 1,
  onDragStart,
  onHold,
  autoScroll,
  overlayRoot,
}: Options) {
  const [state] = useState(createDragState);
  const scroll = useRef<ScrollDrag>({
    start: 0,
    current: 0,
    top: 0,
    bottom: 0,
    fingerX: 0,
    fingerY: 0,
    frame: null,
  });
  const [lift] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const [scale] = useState(() => new Animated.Value(1));
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  // Copia flotante del elemento arrastrado (con overlayRoot): dónde empieza, en la pantalla.
  const [floating, setFloating] = useState<{
    key: string;
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const [views] = useState(() => new Map<string, Measurable>());

  const sizesOf = (order: string[]) => order.map((k) => state.size(k));

  /** Desplazamiento de cada elemento para verse en el orden `order` estando pintado en `keys`. */
  function offsetsFor(order: string[]): Map<string, Point> {
    const before = slotPositions(sizesOf(keys), columns, gap);
    const after = slotPositions(sizesOf(order), columns, gap);
    const result = new Map<string, Point>();
    order.forEach((key, newIndex) => {
      const oldIndex = keys.indexOf(key);
      const a = before[oldIndex] ?? { x: 0, y: 0 };
      const b = after[newIndex] ?? { x: 0, y: 0 };
      result.set(key, { x: b.x - a.x, y: b.y - a.y });
    });
    return result;
  }

  function targetFor(drag: Drag, dx: number, dy: number): number {
    if (columns > 1) return gridDropIndex(sizesOf(keys), columns, gap, drag.from, dx, dy);
    return dropIndex(
      keys.map((k) => state.size(k).height + gap),
      drag.from,
      dy,
    );
  }

  /** El dedo se ha movido: el elemento va con él (más lo que se haya desplazado la lista). */
  function move(dx: number, dy: number) {
    const s = scroll.current;
    s.fingerX = dx;
    s.fingerY = dy;
    place(dx, dy, dy + s.current - s.start);
  }

  function grant() {
    const drag = state.get();
    if (!drag) return;
    drag.granted = true;
    onDragStart?.(drag.key);
    const s = scroll.current;
    if (autoScroll && s.frame === null) s.frame = requestAnimationFrame(tickLoop);
  }

  /**
   * Cada fotograma mientras se arrastra: si el dedo está cerca del borde de la lista, la desplaza
   * un poco (más cuanto más cerca) y recoloca el elemento para que siga bajo el dedo.
   */
  function tick() {
    const drag = state.get();
    const s = scroll.current;
    if (!drag || !autoScroll) {
      s.frame = null;
      return;
    }
    const speed = edgeSpeed(drag.startY + s.fingerY, s.top, s.bottom);
    if (speed !== 0) {
      // Si al empezar la lista ya estaba más arriba del mínimo (barras a la vista), no salta.
      const min = Math.min(autoScroll.minOffset?.() ?? 0, s.start);
      const max = Math.max(autoScroll.maxOffset(), min);
      const next = Math.max(min, Math.min(max, s.current + speed));
      if (next !== s.current) {
        s.current = next;
        autoScroll.ref.current?.scrollTo({ y: next, animated: false });
        place(s.fingerX, s.fingerY, s.fingerY + s.current - s.start);
      }
    }
    s.frame = requestAnimationFrame(tickLoop);
  }

  function stopAutoScroll() {
    const s = scroll.current;
    if (s.frame !== null) cancelAnimationFrame(s.frame);
    s.frame = null;
  }

  /**
   * Coloca el elemento arrastrado y aparta a los demás. (dx, fingerDy): lo que se ha movido el
   * dedo en la pantalla; dy: lo que se ha movido dentro de la lista (más lo desplazado).
   */
  function place(dx: number, fingerDy: number, dy: number) {
    const drag = state.get();
    if (!drag) return;
    // La copia flotante está fuera de la lista: va solo con el dedo.
    lift.setValue({ x: columns > 1 ? dx : 0, y: overlayRoot ? fingerDy : dy });
    const target = targetFor(drag, dx, dy);
    if (target === state.target()) return;
    state.setTarget(target);
    const offsets = offsetsFor(moveItem(keys, drag.from, target));
    keys.forEach((key) => {
      if (key === drag.key) return;
      slide(state.offset(key), offsets.get(key) ?? { x: 0, y: 0 }, MOVE_MS).start();
    });
    if (getSettings().haptics) Haptics.selectionAsync().catch(() => {});
  }

  function finish() {
    const drag = state.get();
    if (!drag) return;
    state.set(null);
    stopAutoScroll();
    const to = state.target();
    const moved = drag.granted && to !== drag.from;
    const order = moved ? moveItem(keys, drag.from, to) : keys;
    const final = moved ? (offsetsFor(order).get(drag.key) ?? { x: 0, y: 0 }) : { x: 0, y: 0 };
    // La copia flotante va a donde se ve su hueco ahora (la lista puede haberse desplazado).
    const scrolled = scroll.current.current - scroll.current.start;
    const landing = overlayRoot ? { x: final.x, y: final.y - scrolled } : final;
    // Se desliza a su hueco y se posa; después se guarda el orden.
    Animated.parallel([
      slide(lift, landing, DROP_MS),
      slide(scale, 1, DROP_MS),
      ...(moved ? [] : keys.map((key) => slide(state.offset(key), { x: 0, y: 0 }, DROP_MS))),
    ]).start(() => {
      state.offset(drag.key).setValue(final);
      setDraggingKey(null);
      setFloating(null);
      if (moved) onReorder(order);
    });
  }

  // Al llegar un orden nuevo, todo vuelve a 0 antes de pintar (ya se pinta en su sitio).
  const keysSignature = keys.join(',');
  useLayoutEffect(() => {
    lift.setValue({ x: 0, y: 0 });
    keysSignature.split(',').forEach((key) => state.offset(key).setValue({ x: 0, y: 0 }));
  }, [keysSignature, lift, state]);

  const [responder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: () => state.get() !== null,
      onPanResponderGrant: () => state.handlers().grant(),
      onPanResponderMove: (e) => {
        const drag = state.get();
        if (!drag) return;
        state.handlers().move(e.nativeEvent.pageX - drag.startX, e.nativeEvent.pageY - drag.startY);
      },
      onPanResponderRelease: () => state.handlers().finish(),
      onPanResponderTerminate: () => state.handlers().finish(),
      onPanResponderTerminationRequest: () => false,
    }),
  );

  /** Mide el elemento y la pantalla y pone encima la copia flotante, en el mismo sitio. */
  function showFloating(key: string) {
    const view = views.get(key);
    const root = overlayRoot?.current;
    if (!view || !root) {
      slide(scale, LIFT_SCALE, 140).start();
      return;
    }
    view.measure((_x, _y, width, _h, pageX, pageY) => {
      root.measure((_rx, _ry, _rw, _rh, rootX, rootY) => {
        // Si ya se soltó mientras se medía, nada.
        if (state.get()?.key !== key) return;
        // El original estaba levantado con `lift`; la copia empieza en su sitio sin levantar.
        setFloating({ key, left: pageX - rootX, top: pageY - rootY, width });
        slide(scale, LIFT_SCALE, 140).start();
      });
    });
  }

  // El PanResponder se crea una vez: tras cada render recibe los manejadores al día.
  const handlers: Handlers = { move, grant, tick, finish };
  useEffect(() => {
    state.setHandlers(handlers);
  });
  // El bucle de cada fotograma llama siempre a la versión más reciente de tick.
  function tickLoop() {
    state.handlers().tick();
  }
  useEffect(
    () => () => {
      const s = scroll.current;
      if (s.frame !== null) cancelAnimationFrame(s.frame);
    },
    [],
  );

  return {
    /** En la vista que envuelve la lista. */
    containerProps: responder.panHandlers,
    /** Se está arrastrando: la lista no debe desplazarse. */
    dragging: draggingKey !== null,
    /** El elemento que se está arrastrando (para ponerlo por encima de los demás). */
    draggingKey,
    /** Copia flotante del elemento arrastrado (dibujarla encima de todo, sin toques). */
    overlay: floating
      ? {
          key: floating.key,
          style: {
            position: 'absolute' as const,
            left: floating.left,
            top: floating.top,
            width: floating.width,
            zIndex: 100,
            elevation: 10,
            transform: [{ translateX: lift.x }, { translateY: lift.y }, { scale }],
          },
        }
      : null,
    /** Lo que necesita cada elemento. */
    itemProps(key: string) {
      const isDragged = key === draggingKey;
      const offset = state.offset(key);
      // Con la copia flotante ya puesta, el original se queda en su sitio, invisible.
      const hiddenOriginal = floating?.key === key;
      return {
        ref: (view: Measurable | null) => {
          if (view) views.set(key, view);
          else views.delete(key);
        },
        onLayout: (e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          state.setSize(key, { width, height });
        },
        style: hiddenOriginal
          ? { opacity: 0, transform: [{ translateX: offset.x }, { translateY: offset.y }] }
          : isDragged
            ? {
                zIndex: 10,
                elevation: 10,
                transform: [{ translateX: lift.x }, { translateY: lift.y }, { scale }],
              }
            : { transform: [{ translateX: offset.x }, { translateY: offset.y }] },
        isDragged,
        /** Mantener pulsado: levanta el elemento (después se arrastra moviendo el dedo). */
        onLongPress: (e: GestureResponderEvent) => {
          const index = keys.indexOf(key);
          if (index === -1) return;
          state.set({
            key,
            from: index,
            startX: e.nativeEvent.pageX,
            startY: e.nativeEvent.pageY,
            granted: false,
          });
          state.setTarget(index);
          lift.setValue({ x: 0, y: 0 });
          // Dónde está la lista en la pantalla y cuánto lleva desplazada, para desplazarla sola
          // al llevar el elemento a un borde.
          if (autoScroll) {
            const s = scroll.current;
            s.start = autoScroll.offset();
            s.current = s.start;
            s.fingerX = 0;
            s.fingerY = 0;
            s.top = 0;
            s.bottom = 0;
            autoScroll.ref.current?.measure((_x, _y, _w, height, _pageX, pageY) => {
              s.top = pageY;
              s.bottom = pageY + height - (autoScroll.bottomInset ?? 0);
            });
          }
          setDraggingKey(key);
          // Con copia flotante, crece después de medirlo (si no, se mediría ya agrandado).
          if (overlayRoot) showFloating(key);
          else slide(scale, LIFT_SCALE, 140).start();
          if (getSettings().haptics) Haptics.selectionAsync().catch(() => {});
        },
        /**
         * Al soltar: si no llegó a moverse, vuelve a su sitio (con un pequeño margen, porque el
         * gesto de la lista se queda con el dedo justo después) y avisa con onHold.
         */
        onPressOut: () => {
          setTimeout(() => {
            const drag = state.get();
            if (drag && drag.key === key && !drag.granted) {
              finish();
              onHold?.(key);
            }
          }, 60);
        },
      };
    },
  };
}

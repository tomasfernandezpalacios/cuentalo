import * as Haptics from 'expo-haptics';
import { useEffect, useLayoutEffect, useState } from 'react';
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
  move: (dx: number, dy: number) => void;
  onDragStart?: (key: string) => void;
  finish: () => void;
};

/**
 * Estado del arrastre, fuera de React (lo leen y cambian los manejadores del gesto). Una
 * función que crea el objeto: así los cambios no son «mutar estado» de React.
 */
function createDragState() {
  let drag: Drag | null = null;
  let handlers: Handlers = { move: () => {}, finish: () => {} };
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
}: Options) {
  const [state] = useState(createDragState);
  const [lift] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  const [scale] = useState(() => new Animated.Value(1));
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

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

  function move(dx: number, dy: number) {
    const drag = state.get();
    if (!drag) return;
    lift.setValue({ x: columns > 1 ? dx : 0, y: dy });
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
    const to = state.target();
    const moved = drag.granted && to !== drag.from;
    const order = moved ? moveItem(keys, drag.from, to) : keys;
    const final = moved ? (offsetsFor(order).get(drag.key) ?? { x: 0, y: 0 }) : { x: 0, y: 0 };
    // Se desliza a su hueco y se posa; después se guarda el orden.
    Animated.parallel([
      slide(lift, final, DROP_MS),
      slide(scale, 1, DROP_MS),
      ...(moved ? [] : keys.map((key) => slide(state.offset(key), { x: 0, y: 0 }, DROP_MS))),
    ]).start(() => {
      state.offset(drag.key).setValue(final);
      setDraggingKey(null);
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
      onPanResponderGrant: () => {
        const drag = state.get();
        if (!drag) return;
        drag.granted = true;
        state.handlers().onDragStart?.(drag.key);
      },
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

  // El PanResponder se crea una vez: tras cada render recibe los manejadores al día.
  const handlers: Handlers = { move, onDragStart, finish };
  useEffect(() => {
    state.setHandlers(handlers);
  });

  return {
    /** En la vista que envuelve la lista. */
    containerProps: responder.panHandlers,
    /** Se está arrastrando: la lista no debe desplazarse. */
    dragging: draggingKey !== null,
    /** El elemento que se está arrastrando (para ponerlo por encima de los demás). */
    draggingKey,
    /** Lo que necesita cada elemento. */
    itemProps(key: string) {
      const isDragged = key === draggingKey;
      const offset = state.offset(key);
      return {
        onLayout: (e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          state.setSize(key, { width, height });
        },
        style: isDragged
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
          setDraggingKey(key);
          slide(scale, LIFT_SCALE, 140).start();
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

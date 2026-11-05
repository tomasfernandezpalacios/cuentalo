import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
} from 'react-native';

import { getSettings } from '@/features/configuracion/settings';

import { dropIndex, moveItem } from './reorder';

// Reordenar una lista vertical manteniendo pulsado y arrastrando (sin librerías de gestos).
//
// * Mantener pulsado un elemento lo «levanta» (onLongPress con la posición del dedo).
// * Al mover el dedo, la capa que envuelve la lista se queda con el gesto: el elemento sigue al
//   dedo y los demás se apartan con una animación corta hacia su nuevo sitio.
// * Al soltar, avisa del nuevo orden (onReorder con las claves) y todo vuelve a su sitio sin
//   saltos (el nuevo orden ya se pinta en su posición).
// * Si se suelta sin mover, no pasa nada (y el elemento hace lo que hiciera al mantenerlo).

type Drag = { key: string; from: number; startY: number; granted: boolean };

/**
 * Estado del arrastre, fuera de React (lo leen y cambian los manejadores del gesto). Una
 * función que crea el objeto: así los cambios no son «mutar estado» de React.
 */
type Handlers = {
  heights: () => number[];
  animateOthers: (from: number, to: number, key: string) => void;
  onDragStart?: (key: string) => void;
  finish: () => void;
};

function createDragState() {
  let drag: Drag | null = null;
  // Lo que el gesto necesita del render más reciente (claves y callbacks al día).
  let handlers: Handlers = { heights: () => [], animateOthers: () => {}, finish: () => {} };
  let target = 0;
  const heights = new Map<string, number>();
  const offsets = new Map<string, Animated.Value>();
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
    height: (key: string) => heights.get(key) ?? 0,
    setHeight: (key: string, value: number) => heights.set(key, value),
    offset: (key: string) => {
      let value = offsets.get(key);
      if (!value) {
        value = new Animated.Value(0);
        offsets.set(key, value);
      }
      return value;
    },
  };
}

type Options = {
  keys: string[];
  onReorder: (keys: string[]) => void;
  /** Hueco entre elementos (se suma a la altura de cada uno al calcular dónde cae). */
  gap?: number;
  /** Empieza a moverse (p. ej. para bloquear el desplazamiento de la lista o salir del modo selección). */
  onDragStart?: (key: string) => void;
};

export function useDragReorder({ keys, onReorder, gap = 0, onDragStart }: Options) {
  const [state] = useState(createDragState);
  const [dy] = useState(() => new Animated.Value(0));
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  const heightsInOrder = () => keys.map((k) => state.height(k) + gap);

  function animateOthers(from: number, to: number, draggedKey: string) {
    const shift = state.height(draggedKey) + gap;
    keys.forEach((key, index) => {
      if (key === draggedKey) return;
      let toValue = 0;
      if (from < to && index > from && index <= to) toValue = -shift;
      if (from > to && index >= to && index < from) toValue = shift;
      Animated.timing(state.offset(key), {
        toValue,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }

  function reset() {
    state.set(null);
    dy.setValue(0);
    keys.forEach((key) => state.offset(key).setValue(0));
    setDraggingKey(null);
  }

  // Si cambia la lista (p. ej. tras guardar el orden), todo vuelve a su sitio.
  const keysSignature = keys.join(',');
  useEffect(() => {
    dy.setValue(0);
    keysSignature.split(',').forEach((key) => state.offset(key).setValue(0));
  }, [keysSignature, dy, state]);

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
        const moved = e.nativeEvent.pageY - drag.startY;
        dy.setValue(moved);
        const target = dropIndex(state.handlers().heights(), drag.from, moved);
        if (target !== state.target()) {
          state.setTarget(target);
          state.handlers().animateOthers(drag.from, target, drag.key);
        }
      },
      onPanResponderRelease: () => state.handlers().finish(),
      onPanResponderTerminate: () => state.handlers().finish(),
      onPanResponderTerminationRequest: () => false,
    }),
  );

  // El PanResponder se crea una vez: tras cada render recibe los manejadores al día.
  const handlers: Handlers = {
    heights: heightsInOrder,
    animateOthers,
    onDragStart,
    finish: () => {
      const drag = state.get();
      if (!drag) return;
      const to = state.target();
      if (drag.granted && to !== drag.from) onReorder(moveItem(keys, drag.from, to));
      reset();
    },
  };
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
      return {
        onLayout: (e: LayoutChangeEvent) => state.setHeight(key, e.nativeEvent.layout.height),
        style: isDragged
          ? {
              zIndex: 10,
              elevation: 10,
              transform: [{ translateY: dy }, { scale: 1.03 }],
            }
          : { transform: [{ translateY: state.offset(key) }] },
        isDragged,
        /** Mantener pulsado: levanta el elemento (después se arrastra moviendo el dedo). */
        onLongPress: (e: GestureResponderEvent) => {
          const index = keys.indexOf(key);
          if (index === -1) return;
          state.set({ key, from: index, startY: e.nativeEvent.pageY, granted: false });
          state.setTarget(index);
          setDraggingKey(key);
          if (getSettings().haptics) Haptics.selectionAsync().catch(() => {});
        },
        /** Al soltar: si no llegó a moverse, se cancela (con un pequeño margen, porque el gesto de la lista se queda con el dedo justo después). */
        onPressOut: () => {
          setTimeout(() => {
            const drag = state.get();
            if (drag && drag.key === key && !drag.granted) reset();
          }, 60);
        },
      };
    },
  };
}

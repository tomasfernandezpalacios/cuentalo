import { useEffect, useState, type ReactNode } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

/** Orden de las pestañas grandes (de izquierda a derecha), con el nombre de su ruta. */
export const TAB_ORDER = ['index', 'estadisticas', 'social', 'perfil'] as const;

/** Cuánto hay que deslizar de lado (puntos) para pasar a la pestaña de al lado. */
const SWIPE_MIN = 70;

type Props = {
  routeName: string;
  navigate: (name: string) => void;
  children: ReactNode;
};

/** Lo que el gesto necesita del último render (fuera de React, con métodos para cambiarlo). */
function createSwipeState(initial: Pick<Props, 'routeName' | 'navigate'>) {
  let current = initial;
  return {
    get: () => current,
    set: (value: Pick<Props, 'routeName' | 'navigate'>) => {
      current = value;
    },
  };
}

/**
 * Envuelve cada pestaña grande: deslizar de lado lleva a la pestaña de al lado (petición del
 * usuario), con la animación de cambio de pestaña (`animation: 'shift'`). Solo se queda con
 * gestos claramente horizontales y que nadie de dentro haya cogido antes: las listas que se
 * desplazan de lado (carpetas, Grupos/Amigos, gráficas) y el arrastre de tarjetas siguen igual.
 */
export function TabSwipeArea({ routeName, navigate, children }: Props) {
  const [state] = useState(() => createSwipeState({ routeName, navigate }));
  useEffect(() => {
    state.set({ routeName, navigate });
  });

  const [responder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dx) < SWIPE_MIN && Math.abs(g.vx) < 0.6) return;
        const { routeName: name, navigate: go } = state.get();
        const index = TAB_ORDER.indexOf(name as (typeof TAB_ORDER)[number]);
        if (index === -1) return;
        // Hacia la izquierda, la pestaña siguiente; hacia la derecha, la anterior.
        const next = TAB_ORDER[g.dx < 0 ? index + 1 : index - 1];
        if (next) go(next);
      },
    }),
  );

  return (
    <View style={styles.fill} {...responder.panHandlers}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

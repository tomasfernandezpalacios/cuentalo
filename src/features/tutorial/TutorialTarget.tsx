import { useLayoutEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';

import type { TargetId } from './steps';
import { registerTarget, unregisterTarget } from './store';

type Props = {
  id: TargetId;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Para marcar solo uno de varios (p. ej. la primera tarjeta de la lista). */
  enabled?: boolean;
};

/**
 * Marca un elemento que el tutorial puede iluminar. El tutorial lo mide una sola vez, en el hilo
 * de la interfaz (`measure` de Reanimated), cuando su pantalla ya está abierta del todo.
 *
 * Siempre es la misma vista (aunque no esté activa) para que activarla o desactivarla no vuelva
 * a montar lo de dentro. collapsable={false}: en Android, sin él la vista puede «aplanarse» y no
 * se podría medir.
 */
export function TutorialTarget({ id, children, style, enabled = true }: Props) {
  const ref = useAnimatedRef<Animated.View>();
  useLayoutEffect(() => {
    if (!enabled) return;
    registerTarget(id, ref);
    return () => unregisterTarget(id, ref);
  }, [id, enabled, ref]);
  return (
    <Animated.View ref={ref} collapsable={false} style={style}>
      {children}
    </Animated.View>
  );
}

import { useCallback, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { TargetId } from './steps';
import { registerTarget, unregisterTarget, type ViewRef } from './store';

type Props = {
  id: TargetId;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Para marcar solo uno de varios (p. ej. la primera tarjeta de la lista). */
  enabled?: boolean;
};

/**
 * Marca un elemento que el tutorial puede iluminar. El TutorialHost mide su posición en la
 * pantalla (measureInWindow) mientras el paso está activo, así sigue al elemento aunque
 * cambie de sitio. collapsable={false}: en Android, sin él la vista puede «aplanarse» y no
 * se podría medir.
 */
export function TutorialTarget({ id, children, style, enabled = true }: Props) {
  const current = useRef<ViewRef | null>(null);
  const ref = useCallback(
    (view: ViewRef | null) => {
      if (view) {
        current.current = view;
        registerTarget(id, view);
      } else if (current.current) {
        unregisterTarget(id, current.current);
        current.current = null;
      }
    },
    [id],
  );
  if (!enabled) return <View style={style}>{children}</View>;
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

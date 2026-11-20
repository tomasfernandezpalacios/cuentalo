import { type ComponentProps, useRef } from 'react';
import { type GestureResponderEvent, Pressable } from 'react-native';

import { isSwiping, isTap } from '@/lib/tapGuard';

type Props = ComponentProps<typeof Pressable>;

/**
 * `Pressable` que no se activa al deslizar (ver `src/lib/tapGuard.ts`): el toque se ignora si el
 * dedo se ha movido o si se está pasando de una pestaña a otra. Misma forma de uso que
 * `Pressable`; se usa en lo que hay dentro de las pestañas grandes.
 */
export function Tappable({ onPressIn, onPress, onLongPress, ...rest }: Props) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const handlePressIn = (e: GestureResponderEvent) => {
    start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    onPressIn?.(e);
  };

  const handlePress = onPress
    ? (e: GestureResponderEvent) => {
        const end = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
        if (isSwiping() || !isTap(start.current, end)) return;
        onPress(e);
      }
    : undefined;

  const handleLongPress = onLongPress
    ? (e: GestureResponderEvent) => {
        if (isSwiping()) return;
        onLongPress(e);
      }
    : undefined;

  return (
    <Pressable
      {...rest}
      onPressIn={handlePressIn}
      onPress={handlePress}
      onLongPress={handleLongPress}
    />
  );
}

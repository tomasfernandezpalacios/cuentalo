import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

import { getSettings } from '@/features/configuracion/settings';

import type { Step } from './steps';

/** Curva de los movimientos del tutorial: arranca y frena con suavidad (ease-in-out). */
export const SMOOTH = Easing.bezier(0.65, 0, 0.35, 1);
/** Curva de las apariciones: rápida al principio y muy suave al final (ease-out). */
export const SOFT_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/** Aparición con fundido (devuelve el valor para poder fundir también al salir). */
export function useFadeIn(duration = 500) {
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      easing: SOFT_OUT,
      useNativeDriver: true,
    }).start();
  }, [opacity, duration]);
  return opacity;
}

/** Valor que va y viene entre 0 y 1 sin parar, en el hilo nativo (latidos). */
export function useLoop(duration: number) {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration]);
  return value;
}

/** Anuncia el paso a los lectores de pantalla. */
export function useAnnounce(step: Step) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${step.title}. ${step.text}`);
  }, [step]);
}

/** Vibración (si está activada en Configuración). */
export function haptic(style: Haptics.ImpactFeedbackStyle) {
  if (getSettings().haptics) Haptics.impactAsync(style).catch(() => {});
}

/** Toque muy leve al cambiar de paso. */
export function tick() {
  if (getSettings().haptics) Haptics.selectionAsync().catch(() => {});
}

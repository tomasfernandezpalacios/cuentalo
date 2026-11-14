import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';

import { isTutorialActive, setStackBusy } from './store';

type TransitionEmitter = {
  addListener: (event: 'transitionStart' | 'transitionEnd', callback: () => void) => () => void;
};

/**
 * Para pantallas de un Stack en las que el tutorial enseña algo (el formulario de crear): avisa
 * al tutorial de cuándo la pantalla se está abriendo o cerrando, para que espere con todo quieto
 * y no ilumine nada hasta que haya terminado (las medidas no ven las animaciones nativas).
 */
export function useTutorialStackScreen() {
  const navigation = useNavigation() as unknown as TransitionEmitter;
  useLayoutEffect(() => {
    if (!isTutorialActive()) return;
    // Al montarse, la pantalla está entrando.
    setStackBusy(true);
    const offStart = navigation.addListener('transitionStart', () => setStackBusy(true));
    const offEnd = navigation.addListener('transitionEnd', () => setStackBusy(false));
    return () => {
      offStart();
      offEnd();
      setStackBusy(false);
    };
  }, [navigation]);
}

/** Antes de cerrar una pantalla del Stack por código (`router.back()`): ya se está moviendo. */
export function markStackLeaving() {
  if (isTutorialActive()) setStackBusy(true);
}

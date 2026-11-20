import { type ReactNode, useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { move, type Move } from './moves';
import { Mascot } from './Mascot';
import { BALL_R, FRAME_MS } from './pose';

/** Zona que ocupa en el diseño, en radios de la bola: de 1,3 sobre ella a 3 bajo ella (patas). */
const LEFT = -2.5;
const TOP = -1.3;
const WIDTH = 5;
const HEIGHT = 4.3;
/** Espacio extra por encima (sin ocupar sitio en el diseño) para que quepan los saltos. */
const HEADROOM = 2.4;
/** Fotograma que se enseña con «reducir movimiento»: el gesto ya hecho, quieto. */
const STILL_FRAME = 24;

/**
 * La mascota haciendo un gesto (`gestures.ts`) o una animación (`animations.ts`) a 30 fotogramas por segundo. `radius` = puntos
 * de pantalla por radio de la bola (la bola mide el doble). Ocupa 5 × 4,3 radios; los saltos
 * pueden salirse por arriba. Mientras `play` es falso no se ve; al pasar a verdadero empieza el
 * gesto desde el principio (sale con un rebote). Con «reducir movimiento» se ve quieta.
 */
export function GestureMascot({
  name,
  radius,
  play = true,
  delayFrames = 0,
  children,
}: {
  name: Move;
  radius: number;
  play?: boolean;
  /** Fotogramas de espera antes de empezar. */
  delayFrames?: number;
  /** Lo que lleva encima (accesorios), en las unidades de la bola. */
  children?: ReactNode;
}) {
  const [frame, setFrame] = useState(-1);
  const [still, setStill] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (alive) setStill(reduce);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Los fotogramas se piden dentro de `requestAnimationFrame`; al parar, se vuelve a ocultar.
  useEffect(() => {
    if (!play) return;
    const start = Date.now();
    let raf = 0;
    const loop = () => {
      setFrame(still ? STILL_FRAME : Math.floor((Date.now() - start) / FRAME_MS) - delayFrames);
      if (!still) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setFrame(-1);
    };
  }, [play, still, delayFrames]);

  const unit = radius / BALL_R;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: WIDTH * radius, height: HEIGHT * radius }}
    >
      <View style={[styles.canvas, { top: -HEADROOM * radius }]}>
        {frame >= 0 ? (
          <Mascot
            pose={move(name, frame)}
            unit={unit}
            placed
            view={{ left: LEFT, top: TOP - HEADROOM, width: WIDTH, height: HEIGHT + HEADROOM }}
          >
            {children}
          </Mascot>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'absolute', left: 0 },
});

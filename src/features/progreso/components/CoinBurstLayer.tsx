import { type ComponentRef, type RefObject, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import {
  COIN_FLIGHT_MS,
  COIN_STAGGER_MS,
  finishBurst,
  getCoinTarget,
  notifyCoinArrived,
  useCoinBursts,
  type CoinBurst,
  type Point,
} from '../coinBurst';
import { CoinIcon } from './Bits';

const SIZE = 26;

/**
 * Capa por encima de todo (sin recibir toques) donde vuelan las monedas ganadas: cada una salta
 * un poco desde donde se ganó y vuela hasta el botón de monedas de la cabecera, que cuenta hacia
 * arriba a medida que llegan.
 */
export function CoinBurstLayer() {
  const bursts = useCoinBursts();
  const ref = useRef<ComponentRef<typeof View>>(null);
  return (
    <View ref={ref} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bursts.map((burst) => (
        <Burst key={burst.id} burst={burst} layer={ref} />
      ))}
    </View>
  );
}

/** Medir el origen de la capa en la ventana, para pasar de coordenadas de ventana a las suyas. */
function measureOrigin(layer: RefObject<ComponentRef<typeof View> | null>): Promise<Point> {
  return new Promise((resolve) => {
    if (!layer.current) return resolve({ x: 0, y: 0 });
    layer.current.measureInWindow((x, y) => resolve({ x, y }));
  });
}

/** Una tanda de monedas: se calcula el recorrido de cada una y se lanzan escalonadas. */
function Burst({
  burst,
  layer,
}: {
  burst: CoinBurst;
  layer: RefObject<ComponentRef<typeof View> | null>;
}) {
  const [path, setPath] = useState<{ from: Point; to: Point } | null>(null);
  const [progress] = useState(() =>
    Array.from({ length: burst.coins }, () => new Animated.Value(0)),
  );
  // Hacia dónde se dispersa cada moneda antes de volar (fijo para cada tanda).
  const [scatter] = useState(() =>
    Array.from({ length: burst.coins }, (_, i) => {
      const angle = (i / burst.coins) * Math.PI * 2 + Math.random() * 0.6;
      const radius = 28 + Math.random() * 34;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius - 20 };
    }),
  );

  useEffect(() => {
    let alive = true;
    Promise.all([measureOrigin(layer), getCoinTarget()]).then(([origin, target]) => {
      if (!alive) return;
      // Sin botón al que ir (otra pantalla delante), se van hacia arriba a la derecha.
      const to = target ?? { x: burst.from.x + 120, y: 40 };
      setPath({
        from: { x: burst.from.x - origin.x, y: burst.from.y - origin.y },
        to: { x: to.x - origin.x, y: to.y - origin.y },
      });
    });
    return () => {
      alive = false;
    };
  }, [burst, layer]);

  useEffect(() => {
    if (!path) return;
    const animations = progress.map((value, i) =>
      Animated.timing(value, {
        toValue: 1,
        duration: COIN_FLIGHT_MS,
        delay: i * COIN_STAGGER_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    animations.forEach((animation) =>
      animation.start(({ finished }) => {
        if (finished) notifyCoinArrived();
      }),
    );
    const total = COIN_FLIGHT_MS + (progress.length - 1) * COIN_STAGGER_MS;
    const timer = setTimeout(() => finishBurst(burst.id), total + 50);
    return () => {
      clearTimeout(timer);
      animations.forEach((animation) => animation.stop());
    };
  }, [path, progress, burst.id]);

  if (!path) return null;
  return (
    <>
      {progress.map((value, i) => {
        const spread = scatter[i] ?? { x: 0, y: 0 };
        // Primer cuarto: salta a su sitio alrededor del origen; el resto: vuela al botón.
        const translateX = value.interpolate({
          inputRange: [0, 0.25, 1],
          outputRange: [path.from.x, path.from.x + spread.x, path.to.x],
        });
        const translateY = value.interpolate({
          inputRange: [0, 0.25, 1],
          outputRange: [path.from.y, path.from.y + spread.y, path.to.y],
        });
        const scale = value.interpolate({
          inputRange: [0, 0.2, 0.85, 1],
          outputRange: [0.3, 1.15, 0.8, 0.5],
        });
        const opacity = value.interpolate({
          inputRange: [0, 0.08, 0.92, 1],
          outputRange: [0, 1, 1, 0],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.coin,
              { opacity, transform: [{ translateX }, { translateY }, { scale }] },
            ]}
          >
            <CoinIcon size={SIZE} />
          </Animated.View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  // Centrada en su punto: se desplaza media moneda hacia arriba y a la izquierda.
  coin: { position: 'absolute', left: -SIZE / 2, top: -SIZE / 2, width: SIZE, height: SIZE },
});

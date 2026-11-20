import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { getSettings } from '@/features/configuracion/settings';
import { MASCOT_BOX, Mascot } from '@/features/mascota/Mascot';
import {
  BAR_X0,
  BAR_X1,
  BALL_R,
  CENTER_FRAME,
  END_FRAME,
  FRAME_MS,
  LINE_Y,
  SPEED,
  pose,
  type Pose,
} from '@/features/mascota/pose';
import { fonts, useThemeColors } from '@/lib/theme';

import { finishStreakCelebration, useStreakCelebration } from '../streakCelebration';

/** Naranja vivo del fuego (petición del usuario: lo veía todo muy apagado): barra, llama y número. */
const FIRE_ORANGE = '#FF6A00';

const IN_MS = 160;
/** Tiempo para ver bien la barra gris con la racha de antes antes de que llegue la mascota. */
const GRAY_MS = 700;
const HOLD_MS = 700;
const OUT_MS = 240;
/** Duración de todo el recorrido de la mascota. */
const RUN_MS = END_FRAME * FRAME_MS;

/** Rebote del número nuevo: (ms después de pasar la bola por el centro, valor de `swap`). */
const SWAP_KEYS: [number, number][] = [
  [0, 0],
  [100, 0.9],
  [180, 1.12],
  [260, 0.97],
  [340, 1],
];

/**
 * Barra de pestañas que celebra la racha (petición del usuario): al subir la racha, los botones
 * se van un momento y en el centro sale la racha actual con el fuego, en gris. La mascota (una
 * bola dorada) entra rodando por la izquierda, y a medida que pasa por encima la barra se vuelve
 * naranja y, al pasar por el número, este cambia al nuevo (sale el viejo hacia arriba y entra el
 * nuevo desde abajo). Al llegar al 70 % de la barra salta sin frenar, le salen brazos y patas y
 * sale por la derecha en el aire. Después vuelven los botones. El movimiento es `mascota/pose.ts`
 * (el mismo que el vídeo de Remotion).
 *
 * Rendimiento (el usuario la veía a tirones en el móvil): todo lo que se mueve lo anima el hilo
 * **nativo**, con una sola línea de tiempo (`progress`, 0 → 1, lineal) de la que salen por
 * interpolación el recorrido de la mascota, el barrido naranja y el cambio de número: ya no
 * dependen de que el hilo de JavaScript esté libre. Lo único que sigue en JS es el dibujo de las
 * extremidades y la cara (30 veces por segundo, solo al cambiar de fotograma). Y mientras dura,
 * `animationGate` retrasa el refresco de datos de la app.
 */
export function StreakCelebrationBar({
  children,
  edge = 0,
  bottomInset = 0,
}: {
  children: ReactNode;
  /** Relleno de la barra a cada lado: el gris y el fuego llegan hasta el borde de la pantalla. */
  edge?: number;
  /** Zona segura bajo los botones: la barra la cubre, así que el color también. */
  bottomInset?: number;
}) {
  const EDGE = edge;
  const colors = useThemeColors();
  const celebration = useStreakCelebration();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  // Opacidad de los botones y del centro, y la línea de tiempo de la mascota (todo nativo).
  const [buttons] = useState(() => new Animated.Value(1));
  const [center] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));
  const [mascot, setMascot] = useState<Pose | null>(null);

  // Puntos de pantalla por píxel del lienzo de la animación: la barra mide `width + 2 EDGE`.
  const unit = (width + 2 * EDGE) / (BAR_X1 - BAR_X0);

  const id = celebration?.id;
  const to = celebration?.to ?? 0;
  useEffect(() => {
    if (id === undefined || width === 0) return;
    buttons.setValue(1);
    center.setValue(0);
    progress.setValue(0);
    const timing = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, { toValue, duration, useNativeDriver: true });
    let current: Animated.CompositeAnimation | null = null;
    let frame = 0;
    let stopped = false;
    let hapticTimer: ReturnType<typeof setTimeout> | null = null;

    // Al terminar la mascota: un momento quieto y vuelta de los botones.
    const leave = () => {
      current = Animated.sequence([
        Animated.delay(HOLD_MS),
        Animated.parallel([timing(center, 0, OUT_MS), timing(buttons, 1, OUT_MS)]),
      ]);
      current.start(({ finished }) => {
        if (finished) finishStreakCelebration(id);
      });
    };

    // La mascota: la línea de tiempo corre en el hilo nativo; aquí solo se redibuja su postura
    // (extremidades, cara) al cambiar de fotograma, y se avisa al pasar por el número.
    const run = () => {
      const start = Date.now();
      let lastFrame = -1;
      const tick = () => {
        if (stopped) return;
        const f = Math.min((Date.now() - start) / FRAME_MS, END_FRAME - 0.01);
        const whole = Math.floor(f);
        if (whole !== lastFrame) {
          lastFrame = whole;
          const p = pose(whole);
          if (p) setMascot(p);
        }
        frame = requestAnimationFrame(tick);
      };
      setMascot(pose(0));
      frame = requestAnimationFrame(tick);
      hapticTimer = setTimeout(() => {
        if (getSettings().haptics) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        AccessibilityInfo.announceForAccessibility(`Racha de ${to} ${to === 1 ? 'día' : 'días'}`);
      }, CENTER_FRAME * FRAME_MS);
      current = Animated.timing(progress, {
        toValue: 1,
        duration: RUN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      });
      current.start(({ finished }) => {
        cancelAnimationFrame(frame);
        setMascot(null);
        if (finished && !stopped) leave();
      });
    };

    // Entrada (los botones se van, sale la racha en gris) y un momento en gris.
    current = Animated.sequence([
      Animated.parallel([timing(buttons, 0, IN_MS), timing(center, 1, IN_MS)]),
      Animated.delay(GRAY_MS),
    ]);
    current.start(({ finished }) => {
      if (finished && !stopped) run();
    });
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      if (hapticTimer) clearTimeout(hapticTimer);
      current?.stop();
      setMascot(null);
    };
  }, [id, to, width, buttons, center, progress]);

  // Fracción de barra ya recorrida (0 → 1): la bola avanza a velocidad constante, así que es
  // lineal en el tiempo entre que su borde entra en la barra y sale de ella.
  const sweep = useMemo(
    () =>
      progress.interpolate({
        inputRange: [(BALL_R + BAR_X0) / SPEED / END_FRAME, (BALL_R + BAR_X1) / SPEED / END_FRAME],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [progress],
  );
  // Cambio de número (0 → 1 con un pequeño rebote) justo cuando la bola pasa por el centro.
  const swap = useMemo(() => {
    const c = CENTER_FRAME / END_FRAME;
    return progress.interpolate({
      inputRange: SWAP_KEYS.map(([ms]) => c + ms / RUN_MS),
      outputRange: SWAP_KEYS.map(([, v]) => v),
      extrapolate: 'clamp',
    });
  }, [progress]);

  // Recorrido de la mascota en pantalla, muestreado fotograma a fotograma (la interpolación nativa
  // lo une en línea recta, igual que el vídeo a 30 fps).
  const track = useMemo(() => {
    const input: number[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    const scales: number[] = [];
    const tilts: string[] = [];
    for (let i = 0; i <= Math.ceil(END_FRAME); i++) {
      const f = Math.min(i, END_FRAME - 0.01);
      const p = pose(f);
      const at = f / END_FRAME;
      if (!p || (input.length > 0 && at <= (input[input.length - 1] ?? 0))) continue;
      input.push(at);
      xs.push((p.x - BAR_X0) * unit - EDGE);
      ys.push(height / 2 + (p.y - LINE_Y) * unit);
      scales.push(p.scale);
      tilts.push(`${p.tilt}deg`);
    }
    const map = <T extends number | string>(outputRange: T[]) =>
      progress.interpolate({ inputRange: input, outputRange });
    return {
      translateX: map(xs),
      translateY: map(ys),
      scale: map(scales),
      rotate: map(tilts),
    };
  }, [progress, unit, height, EDGE]);

  // El gris (barra, llama y número) se va cuando el fuego ya lo cubre todo.
  // `clamp`: sin él, antes de 0,85 la opacidad pasaba de 1 y el gris de la barra salía opaco y
  // tapaba la llama y el número grises.
  const grayOpacity = sweep.interpolate({
    inputRange: [0.85, 1],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  // El recorte del fuego crece de izquierda a derecha sin tocar el layout: una máscara (con
  // `overflow: hidden`) que se desliza y, dentro, el contenido que se desliza al revés.
  const barWidth = width + 2 * EDGE;
  const maskX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-barWidth, 0] });
  const contentX = sweep.interpolate({ inputRange: [0, 1], outputRange: [barWidth, 0] });

  const from = celebration?.from ?? 0;
  const oldY = swap.interpolate({ inputRange: [0, 1], outputRange: [0, -26] });
  const oldOpacity = swap.interpolate({
    inputRange: [0, 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const newY = swap.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });
  const newOpacity = swap.interpolate({
    inputRange: [0, 0.4],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const newScale = swap.interpolate({ inputRange: [0, 1], outputRange: [1.5, 1] });
  const flamePop = swap.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.35, 1],
    extrapolate: 'clamp',
  });

  const number = (value: number, color: string) => (
    <Text style={[styles.number, { color }]} maxFontSizeMultiplier={1.2}>
      {value}
    </Text>
  );
  // Hueco del número: del ancho del más largo, para que el fuego y las cifras no se muevan.
  const widest = String(Math.max(from, to));

  return (
    <View
      style={styles.flex}
      onLayout={(e) =>
        setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
      }
    >
      <Animated.View
        style={[styles.flex, { opacity: buttons }]}
        pointerEvents={celebration ? 'none' : 'auto'}
      >
        {children}
      </Animated.View>
      {celebration ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: center }]}
          importantForAccessibility="no-hide-descendants"
        >
          {/* Racha actual en gris, con toda la barra en gris (sin brillos, petición del usuario). */}
          <Animated.View
            style={[
              styles.tint,
              {
                left: -EDGE,
                right: -EDGE,
                bottom: -bottomInset,
                backgroundColor: colors.textMuted,
                opacity: Animated.multiply(grayOpacity, 0.35),
              },
            ]}
          />
          <Animated.View style={[styles.center, { opacity: grayOpacity }]}>
            <Ionicons name="flame" size={30} color={colors.textMuted} />
            <View>
              <Text style={[styles.number, styles.hidden]}>{widest}</Text>
              {/* El número gris se va cuando la bola pasa por encima y entra el nuevo. */}
              <Animated.View style={[styles.numberSlot, { opacity: oldOpacity }]}>
                {number(from, colors.textMuted)}
              </Animated.View>
            </View>
          </Animated.View>
          {/* Lo mismo en color fuego, descubierto a medida que pasa la bola. */}
          <View style={[styles.clip, { left: -EDGE, bottom: -bottomInset, width: barWidth }]}>
            <Animated.View
              style={[styles.mask, { width: barWidth, transform: [{ translateX: maskX }] }]}
            >
              <Animated.View
                style={[styles.mask, { width: barWidth, transform: [{ translateX: contentX }] }]}
              >
                {/* La barra se vuelve color fuego en la zona ya recorrida (tapa el gris). */}
                <View style={[styles.fill, { width: barWidth, backgroundColor: colors.surface }]} />
                <View
                  style={[
                    styles.fill,
                    styles.fireFill,
                    { width: barWidth, backgroundColor: FIRE_ORANGE },
                  ]}
                />
                <View style={[styles.fixedCenter, { left: EDGE, width, height }]}>
                  <Animated.View style={{ transform: [{ scale: flamePop }] }}>
                    <Ionicons name="flame" size={30} color={FIRE_ORANGE} />
                  </Animated.View>
                  <View>
                    <Text style={[styles.number, styles.hidden]}>{widest}</Text>
                    <Animated.View
                      style={[
                        styles.numberSlot,
                        { opacity: oldOpacity, transform: [{ translateY: oldY }] },
                      ]}
                    >
                      {number(from, FIRE_ORANGE)}
                    </Animated.View>
                    <Animated.View
                      style={[
                        styles.numberSlot,
                        {
                          opacity: newOpacity,
                          transform: [{ translateY: newY }, { scale: newScale }],
                        },
                      ]}
                    >
                      {number(to, FIRE_ORANGE)}
                    </Animated.View>
                  </View>
                </View>
              </Animated.View>
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}
      {/* La mascota va por encima de todo y sale de la barra al saltar (sin recortarse). Su vista
          está centrada en (0, 0) de la barra y el hilo nativo la lleva, la inclina y la escala. */}
      {celebration && mascot ? (
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          style={{
            position: 'absolute',
            left: -(MASCOT_BOX * unit) / 2,
            top: -(MASCOT_BOX * unit) / 2,
            width: MASCOT_BOX * unit,
            height: MASCOT_BOX * unit,
            transform: [
              { translateX: track.translateX },
              { translateY: track.translateY },
              { rotate: track.rotate },
              { scale: track.scale },
            ],
          }}
        >
          <Mascot pose={mascot} unit={unit} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Toda la barra: también su relleno a los lados y la zona segura de abajo (recta, sin esquinas
  // redondeadas, como la barra).
  tint: { position: 'absolute', top: 0 },
  center: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  // Igual que `center` (mismo ancho y alto que los botones), dentro del recorte que crece; el
  // recorte empieza `edge` antes, así queda justo encima de la copia gris.
  fixedCenter: {
    position: 'absolute',
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  // Ventana fija de toda la barra; lo que se desliza dentro solo se ve donde ya ha pasado la bola.
  clip: { position: 'absolute', top: 0, overflow: 'hidden' },
  mask: { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  fireFill: { opacity: 0.4 },
  number: { fontFamily: fonts.title, fontSize: 28, includeFontPadding: false },
  hidden: { opacity: 0 },
  numberSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { getSettings } from '@/features/configuracion/settings';
import { fonts, useThemeColors } from '@/lib/theme';

import { finishStreakCelebration, useStreakCelebration } from '../streakCelebration';

/** Ancho de la franja de fuego que cruza la barra. */
const BAND = 150;
/** Amarillo del corazón de las llamas (el naranja es `colors.flame`). */
const FIRE_YELLOW = '#FFC24A';
/** Llamas de la franja, de la cola (izquierda) al frente (derecha): crecen hacia el frente. */
const FLAMES = [
  { size: 16, x: 18, yellow: false },
  { size: 22, x: 36, yellow: true },
  { size: 28, x: 56, yellow: false },
  { size: 36, x: 78, yellow: true },
  { size: 44, x: 100, yellow: false },
  { size: 34, x: 120, yellow: true },
];

const IN_MS = 160;
// Un poco más lenta que al principio (petición del usuario).
const SWEEP_MS = 820;
/** Margen de la barra a cada lado (el relleno de la cápsula): el color llega hasta el borde. */
const EDGE = 8;
/** Centro de la llama más grande dentro de la fila: ahí está el borde del cambio de color. */
const FRONT_X = 100;
const HOLD_MS = 700;
const OUT_MS = 240;

/**
 * Barra de pestañas que celebra la racha (petición del usuario): al subir la racha, los botones
 * se van un momento y en el centro sale la racha actual con el fuego, en gris. Una fila de
 * llamas cruza de izquierda a derecha; a su paso todo se vuelve color fuego y el número cambia
 * al nuevo (sale el viejo hacia arriba y entra el nuevo desde abajo). Después vuelven los
 * botones. Todo en algo más de 2 s.
 */
export function StreakCelebrationBar({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  const celebration = useStreakCelebration();
  const [width, setWidth] = useState(0);
  // Opacidad de los botones, del centro, avance de la franja (0 → 1) y cambio de número (0 → 1).
  const [buttons] = useState(() => new Animated.Value(1));
  const [center] = useState(() => new Animated.Value(0));
  const [sweep] = useState(() => new Animated.Value(0));
  const [swap] = useState(() => new Animated.Value(0));
  // Parpadeo de las llamas (en el hilo nativo, aparte del resto).
  const [flicker] = useState(() => new Animated.Value(0));

  const id = celebration?.id;
  const to = celebration?.to ?? 0;
  useEffect(() => {
    if (id === undefined || width === 0) return;
    buttons.setValue(1);
    center.setValue(0);
    sweep.setValue(0);
    swap.setValue(0);
    const flickering = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0, duration: 110, useNativeDriver: true }),
      ]),
    );
    const timing = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, { toValue, duration, useNativeDriver: false });
    // Entrada y franja de fuego.
    const first = Animated.sequence([
      Animated.parallel([timing(buttons, 0, IN_MS), timing(center, 1, IN_MS)]),
      Animated.timing(sweep, {
        toValue: 1,
        duration: SWEEP_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);
    // Cambio de número, un momento quieto y vuelta de los botones.
    const second = Animated.sequence([
      Animated.spring(swap, { toValue: 1, friction: 5, tension: 160, useNativeDriver: false }),
      Animated.delay(HOLD_MS),
      Animated.parallel([timing(center, 0, OUT_MS), timing(buttons, 1, OUT_MS)]),
    ]);
    let current: Animated.CompositeAnimation = first;
    flickering.start();
    first.start(({ finished }) => {
      if (!finished) return;
      if (getSettings().haptics) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      AccessibilityInfo.announceForAccessibility(`Racha de ${to} ${to === 1 ? 'día' : 'días'}`);
      current = second;
      second.start(() => {
        flickering.stop();
        finishStreakCelebration(id);
      });
    });
    return () => {
      current.stop();
      flickering.stop();
    };
  }, [id, to, width, buttons, center, sweep, swap, flicker]);

  // Frente de la franja: sale de fuera por la izquierda y acaba fuera por la derecha.
  const travel = width + BAND;
  const front = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-BAND / 2, width + BAND / 2],
  });
  // La zona que deja atrás la llama se vuelve color fuego (el recorte llega justo a la llama).
  const startCovering = (BAND / 2 - EDGE) / Math.max(1, travel);
  const clipWidth = sweep.interpolate({
    inputRange: [0, startCovering, 1],
    outputRange: [0, 0, width + BAND / 2 + EDGE],
  });
  const bandX = Animated.subtract(front, FRONT_X);
  const bandOpacity = sweep.interpolate({
    inputRange: [0, 0.08, 0.9, 1],
    outputRange: [0, 1, 1, 0],
  });
  // El gris (barra, llama y número) se va cuando el fuego ya lo cubre todo.
  const grayOpacity = sweep.interpolate({ inputRange: [0.85, 1], outputRange: [1, 0] });

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
  const flamePop = swap.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.35, 1] });

  const number = (value: number, color: string) => (
    <Text style={[styles.number, { color }]} maxFontSizeMultiplier={1.2}>
      {value}
    </Text>
  );
  // Hueco del número: del ancho del más largo, para que el fuego y las cifras no se muevan.
  const widest = String(Math.max(from, to));

  return (
    <View style={styles.flex} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
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
              { backgroundColor: colors.textMuted, opacity: Animated.multiply(grayOpacity, 0.25) },
            ]}
          />
          <Animated.View style={[styles.center, { opacity: grayOpacity }]}>
            <Ionicons name="flame" size={30} color={colors.textMuted} />
            <View>
              <Text style={[styles.number, styles.hidden]}>{widest}</Text>
              <View style={styles.numberSlot}>{number(from, colors.textMuted)}</View>
            </View>
          </Animated.View>
          {/* Lo mismo en color fuego, descubierto a medida que pasa la franja. */}
          <Animated.View style={[styles.clip, { width: clipWidth }]}>
            {/* La barra se vuelve color fuego en la zona ya recorrida (tapa el gris). */}
            <View
              style={[styles.fill, { width: width + 2 * EDGE, backgroundColor: colors.surface }]}
            />
            <View
              style={[
                styles.fill,
                styles.fireFill,
                { width: width + 2 * EDGE, backgroundColor: colors.flame },
              ]}
            />
            <View style={[styles.fixedCenter, { width }]}>
              <Animated.View style={{ transform: [{ scale: flamePop }] }}>
                <Ionicons name="flame" size={30} color={colors.flame} />
              </Animated.View>
              <View>
                <Text style={[styles.number, styles.hidden]}>{widest}</Text>
                <Animated.View
                  style={[
                    styles.numberSlot,
                    { opacity: oldOpacity, transform: [{ translateY: oldY }] },
                  ]}
                >
                  {number(from, colors.flame)}
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
                  {number(to, colors.flame)}
                </Animated.View>
              </View>
            </View>
          </Animated.View>
          {/* Fila de llamas en movimiento (solo llamas): lleva el cambio de color. */}
          <Animated.View
            style={[styles.band, { opacity: bandOpacity, transform: [{ translateX: bandX }] }]}
          >
            {FLAMES.map((f, i) => (
              <Animated.View
                key={f.x}
                style={[
                  styles.flame,
                  {
                    left: f.x - f.size / 2,
                    transform: [
                      {
                        scaleY: flicker.interpolate({
                          inputRange: [0, 1],
                          outputRange: i % 2 === 0 ? [0.82, 1.18] : [1.15, 0.85],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Ionicons
                  name="flame"
                  size={f.size}
                  color={f.yellow ? FIRE_YELLOW : colors.flame}
                />
              </Animated.View>
            ))}
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Toda la cápsula (también su relleno a los lados).
  tint: { position: 'absolute', top: 0, bottom: 0, left: -EDGE, right: -EDGE, borderRadius: 999 },
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
  // Igual que `center` pero con el ancho de toda la barra, dentro del recorte que crece.
  fixedCenter: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    // El recorte empieza EDGE antes: así queda justo encima de la copia gris.
    left: EDGE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  clip: { position: 'absolute', top: 0, bottom: 0, left: -EDGE, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 999 },
  fireFill: { opacity: 0.25 },
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
  // Más alta que la barra: las llamas asoman por arriba.
  band: { position: 'absolute', top: -18, bottom: 0, left: 0, width: BAND },
  flame: { position: 'absolute', bottom: 8 },
});

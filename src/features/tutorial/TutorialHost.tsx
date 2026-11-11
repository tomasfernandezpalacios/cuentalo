import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { AppButton } from '@/components/AppButton';
import { getSettings } from '@/features/configuracion/settings';
import { fonts, useThemeColors } from '@/lib/theme';

import { dimPath, type Hole, holeFor, lerpHole, placeBubble, type Rect } from './layout';
import { stepKind, type Step } from './steps';
import {
  continueTutorial,
  getTarget,
  nextStep,
  skipTutorial,
  useTutorial,
  type ViewRef,
} from './store';

const DIM = 'rgba(8, 8, 16, 0.66)';
/** Si el elemento no aparece en este tiempo, el paso se enseña sin foco (con «Siguiente»). */
const TARGET_TIMEOUT_MS = 1500;
const MEASURE_EVERY_MS = 250;

/**
 * Tutorial de bienvenida: se monta una vez en el layout raíz (como DialogHost) y pinta el paso
 * actual por encima de la app. La bienvenida va a pantalla completa; «Esto es Cuéntalo» es un
 * aviso sobre la app que se pasa solo; el resto ilumina un elemento (TutorialTarget) con un
 * bocadillo, una flecha y un anillo que late. Cada paso dice en qué pestaña se enseña: al
 * llegar a él, el tutorial va a esa pestaña; si el usuario está en otra pantalla (p. ej.
 * creando el contador), se aparta.
 */
export function TutorialHost() {
  const { step, index, steps } = useTutorial();
  const pathname = usePathname();
  const stepId = step?.id;
  // Pantalla del paso: a la que va el tutorial al llegar a él (una sola vez), salvo que llegue
  // el propio usuario (p. ej. el formulario de crear, al tocar el +).
  const screen = step && !step.userNavigates ? (step.screen ?? '/') : null;
  const autoAdvanceMs = step?.autoAdvanceMs;

  useEffect(() => {
    if (screen) router.navigate(screen);
  }, [stepId, screen]);

  // Pasos que se pasan solos («Esto es Cuéntalo»).
  useEffect(() => {
    if (!autoAdvanceMs) return;
    const timer = setTimeout(nextStep, autoAdvanceMs);
    return () => clearTimeout(timer);
  }, [stepId, autoAdvanceMs]);

  if (!step || index === null) return null;
  const kind = stepKind(step);
  if (kind === 'welcome') {
    return <Welcome step={step} index={index} total={steps.length} />;
  }
  if (kind === 'finish') return <Finish step={step} index={index} total={steps.length} />;
  if (pathname !== (step.screen ?? '/')) return null;
  if (kind === 'banner') return <Banner step={step} />;
  return (
    <Layer>
      {(origin, size) => (
        <Spotlight step={step} index={index} total={steps.length} origin={origin} size={size} />
      )}
    </Layer>
  );
}

type Size = { width: number; height: number };

/**
 * Capa que ocupa toda la app y sirve de referencia: se mide a sí misma con measureInWindow y
 * los elementos se colocan respecto a ella. Así el foco cae justo encima del elemento aunque la
 * ventana y la vista raíz no empiecen en el mismo sitio (barra de estado, edge-to-edge…).
 */
function Layer({
  children,
}: {
  children: (origin: ViewRef | null, size: Size | null) => ReactNode;
}) {
  const [origin, setOrigin] = useState<ViewRef | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  return (
    <View
      ref={setOrigin}
      collapsable={false}
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, styles.layer]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((old) =>
          old && old.width === width && old.height === height ? old : { width, height },
        );
      }}
    >
      {children(origin, size)}
    </View>
  );
}

/**
 * Mide el elemento del paso cada poco (sigue al elemento si se mueve), relativo a la capa del
 * tutorial: se miden los dos en coordenadas de la ventana y se restan.
 */
function useTargetRect(
  step: Step,
  origin: ViewRef | null,
): { rect: Rect | null; missing: boolean } {
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!step.target || !origin) return;
    const target = step.target;
    const startedAt = Date.now();
    const measure = () => {
      const view = getTarget(target);
      if (!view) {
        if (Date.now() - startedAt > TARGET_TIMEOUT_MS) setMissing(true);
        return;
      }
      origin.measureInWindow((ox, oy) => {
        view.measureInWindow((tx, ty, width, height) => {
          if (width <= 0 || height <= 0) return;
          const x = tx - ox;
          const y = ty - oy;
          setMissing(false);
          setRect((old) =>
            old &&
            Math.abs(old.x - x) < 1 &&
            Math.abs(old.y - y) < 1 &&
            old.width === width &&
            old.height === height
              ? old
              : { x, y, width, height },
          );
        });
      });
    };
    measure();
    const timer = setInterval(measure, MEASURE_EVERY_MS);
    return () => clearInterval(timer);
  }, [step.target, origin]);

  return { rect, missing };
}

/** Aparición con fundido de cada paso. */
function useFadeIn() {
  const opacity = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [opacity]);
  return opacity;
}

/** Valor que va y viene entre 0 y 1 sin parar (latido del anillo, flecha). */
function useLoop(duration: number) {
  const value = useState(() => new Animated.Value(0))[0];
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
function useAnnounce(step: Step) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${step.title}. ${step.text}`);
  }, [step]);
}

/** Primera pantalla: ocupa todo el dispositivo; abajo, la barra de progreso y «Seguir». */
function Welcome({ step, index, total }: { step: Step; index: number; total: number }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const opacity = useFadeIn();
  const float = useLoop(1400);
  useAnnounce(step);
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.welcome,
        {
          backgroundColor: colors.background,
          opacity,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
      accessibilityViewIsModal
    >
      <View style={styles.welcomeBody}>
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[
            styles.logo,
            {
              backgroundColor: colors.primary,
              transform: [
                { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
              ],
            },
          ]}
        >
          <Text style={[styles.logoText, { color: colors.onPrimary }]}>+1</Text>
        </Animated.View>
        <Text style={[styles.welcomeTitle, { color: colors.text }]} accessibilityRole="header">
          {step.title}
        </Text>
        {step.subtitle ? (
          <Text style={[styles.welcomeSubtitle, { color: colors.primary }]}>{step.subtitle}</Text>
        ) : null}
        <Text style={[styles.welcomeText, { color: colors.textMuted }]}>{step.text}</Text>
      </View>
      <View style={styles.welcomeButtons}>
        <Progress index={index} total={total} />
        <AppButton title={step.button ?? 'Seguir'} onPress={continueTutorial} />
      </View>
    </Animated.View>
  );
}

const HOLD_MS = 2600;
const CIRCLE = 104;

function haptic(style: Haptics.ImpactFeedbackStyle) {
  if (getSettings().haptics) Haptics.impactAsync(style).catch(() => {});
}

/**
 * Pantalla final: «Todo listo» y, abajo, un círculo con una huella. Mantenerlo pulsado hace
 * desaparecer la huella y crecer el círculo hasta llenar la pantalla; entonces sale «"Me
 * comprometo a registrar mi vida"» y se acaba el tutorial. Si se suelta antes, vuelve a su
 * tamaño (con un pequeño rebote) y la huella reaparece: se puede intentar las veces que haga
 * falta.
 */
function Finish({ step, index, total }: { step: Step; index: number; total: number }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const opacity = useFadeIn();
  const breathe = useLoop(1100);
  const [grow] = useState(() => new Animated.Value(0));
  const [promise] = useState(() => new Animated.Value(0));
  const [brand] = useState(() => new Animated.Value(0));
  const [fadeOut] = useState(() => new Animated.Value(1));
  const [done, setDone] = useState(false);
  useAnnounce(step);

  // Escala con la que el círculo cubre toda la pantalla desde su sitio (abajo en el centro).
  const cover = (2 * Math.hypot(width / 2, height)) / CIRCLE + 1;

  function finish() {
    setDone(true);
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(promise, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(promise, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(brand, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(1300),
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 450,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.navigate('/');
      nextStep();
    });
  }

  function press() {
    if (done) return;
    haptic(Haptics.ImpactFeedbackStyle.Light);
    grow.stopAnimation((value) => {
      Animated.timing(grow, {
        toValue: 1,
        // Lo que falte, a la misma velocidad (si se vuelve a pulsar a medio camino).
        duration: HOLD_MS * (1 - value),
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) finish();
      });
    });
  }

  function release() {
    if (done) return;
    grow.stopAnimation();
    Animated.spring(grow, {
      toValue: 0,
      friction: 6,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }

  const scale = grow.interpolate({ inputRange: [0, 1], outputRange: [1, cover] });
  const printOpacity = grow.interpolate({
    inputRange: [0, 0.12],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const printScale = grow.interpolate({
    inputRange: [0, 0.12],
    outputRange: [1, 0.6],
    extrapolate: 'clamp',
  });
  const idle = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.finish,
        {
          backgroundColor: colors.background,
          opacity: Animated.multiply(opacity, fadeOut),
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 32,
        },
      ]}
      accessibilityViewIsModal
    >
      <Progress index={index} total={total} />
      <View style={styles.finishBody}>
        <Text style={[styles.finishTitle, { color: colors.text }]} accessibilityRole="header">
          {step.title}
        </Text>
        <Text style={[styles.finishText, { color: colors.textMuted }]}>{step.text}</Text>
      </View>
      <View style={styles.finishBottom}>
        {/* Latido suave mientras espera; al pulsar, crece hasta cubrir la pantalla. */}
        <Animated.View style={{ transform: [{ scale: idle }] }}>
          <Pressable
            onPressIn={press}
            onPressOut={release}
            delayLongPress={HOLD_MS * 2}
            accessibilityRole="button"
            accessibilityLabel="Mantén pulsado para terminar el tutorial"
          >
            <Animated.View
              style={[styles.circle, { backgroundColor: colors.primary, transform: [{ scale }] }]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.print, { opacity: printOpacity, transform: [{ scale: printScale }] }]}
            >
              <Ionicons name="finger-print" size={64} color={colors.background} />
            </Animated.View>
          </Pressable>
        </Animated.View>
        <Animated.Text
          style={[styles.holdHint, { color: colors.textMuted, opacity: printOpacity }]}
        >
          Mantén pulsado
        </Animated.Text>
      </View>
      {/* Con la pantalla ya cubierta: la promesa, sobre el color del círculo. */}
      {done ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.promise,
            {
              opacity: promise,
              transform: [
                { scale: promise.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
              ],
            },
          ]}
        >
          <Text style={[styles.promiseText, { color: colors.onPrimary }]}>
            &quot;Me comprometo a registrar mi vida&quot;
          </Text>
        </Animated.View>
      ) : null}
      {done ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.promise,
            {
              opacity: brand,
              transform: [
                { scale: brand.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
              ],
            },
          ]}
        >
          <Text style={[styles.brandText, { color: colors.onPrimary }]}>Cuéntalo</Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** «Esto es Cuéntalo»: se ve la app entera unos segundos con un aviso encima (sin tocar nada). */
function Banner({ step }: { step: Step }) {
  const colors = useThemeColors();
  const opacity = useFadeIn();
  useAnnounce(step);
  return (
    <View style={[StyleSheet.absoluteFill, styles.layer, styles.bannerLayer]}>
      <Blocker style={StyleSheet.absoluteFill} />
      <Animated.View
        pointerEvents="none"
        style={[styles.banner, { backgroundColor: colors.text, opacity }]}
      >
        <Text style={[styles.bannerText, { color: colors.background }]}>{step.title}</Text>
      </Animated.View>
    </View>
  );
}

type SpotlightProps = {
  step: Step;
  index: number;
  total: number;
  origin: ViewRef | null;
  size: Size | null;
};

// Movimientos lentos y suaves: fluidez antes que velocidad.
const MOVE_MS = 950;

/**
 * El foco que se enseña: cuando el paso cambia de elemento, se desliza del anterior al nuevo
 * (posición y tamaño) en vez de saltar. Todo lo demás (oscurecido, anillo, flecha, bocadillo)
 * sigue a este foco, así se mueve todo junto y con calma.
 */
/** Diferencia de menos de un cuarto de píxel: a la vista, el mismo hueco. */
function sameHole(a: Hole, b: Hole): boolean {
  return (
    Math.abs(a.x - b.x) < 0.25 &&
    Math.abs(a.y - b.y) < 0.25 &&
    Math.abs(a.width - b.width) < 0.25 &&
    Math.abs(a.height - b.height) < 0.25
  );
}

function useGlidingHole(target: Hole | null): Hole | null {
  const [shown, setShown] = useState<Hole | null>(null);
  const [t] = useState(() => new Animated.Value(0));
  const current = useRef<Hole | null>(null);

  useEffect(() => {
    if (!target) return;
    const from = current.current;
    const id = t.addListener(({ value }) => {
      const hole = from ? lerpHole(from, target, value) : target;
      const last = current.current;
      if (last && sameHole(last, hole)) return;
      current.current = hole;
      setShown(hole);
    });
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration: from ? MOVE_MS : 1,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => {
      t.stopAnimation();
      t.removeListener(id);
    };
  }, [t, target]);

  return shown;
}

function Spotlight({ step, index, total, origin, size }: SpotlightProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const windowSize = useWindowDimensions();
  // Tamaño de la capa (no de la ventana): es donde se dibuja todo.
  const width = size?.width ?? windowSize.width;
  const height = size?.height ?? windowSize.height;
  const { rect, missing } = useTargetRect(step, origin);
  const [bubbleHeight, setBubbleHeight] = useState(150);
  const opacity = useFadeIn();
  const pulse = useLoop(1300);
  const nudge = useLoop(900);
  useAnnounce(step);

  const target = useMemo(() => (rect && !missing ? holeFor(rect) : null), [rect, missing]);
  const hole = useGlidingHole(target);

  const screen = { width, height, top: insets.top, bottom: insets.bottom };
  const shownHole = missing ? null : hole;
  const place = shownHole ? placeBubble(shownHole, bubbleHeight, screen) : null;
  // Tocar el elemento iluminado: o se deja tocar la app (sumar, restar, el +…) o lo recoge el
  // propio tutorial (pestañas y racha: se sigue sin cambiar de pantalla).
  const passThrough = Boolean(step.action) && shownHole;

  if (!shownHole && !missing) {
    // Aún midiendo: solo el oscurecido, sin dejar tocar nada.
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} />;
  }

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="box-none">
      {shownHole ? (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d={dimPath(width, height, shownHole)} fill={DIM} fillRule="evenodd" />
        </Svg>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} pointerEvents="none" />
      )}

      {/* Lo que no se puede tocar: todo menos el hueco cuando la tarea es tocar la app. */}
      {passThrough && shownHole ? (
        <>
          <Blocker style={{ left: 0, right: 0, top: 0, height: Math.max(0, shownHole.y) }} />
          <Blocker style={{ left: 0, right: 0, top: shownHole.y + shownHole.height, bottom: 0 }} />
          <Blocker
            style={{
              left: 0,
              width: Math.max(0, shownHole.x),
              top: shownHole.y,
              height: shownHole.height,
            }}
          />
          <Blocker
            style={{
              left: shownHole.x + shownHole.width,
              right: 0,
              top: shownHole.y,
              height: shownHole.height,
            }}
          />
        </>
      ) : (
        <Blocker style={StyleSheet.absoluteFill} />
      )}

      {shownHole ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              left: shownHole.x,
              top: shownHole.y,
              width: shownHole.width,
              height: shownHole.height,
              borderRadius: shownHole.radius,
              borderColor: colors.primary,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }),
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
              ],
            },
          ]}
        />
      ) : null}

      {place ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.arrow,
            {
              left: place.arrowX - 15,
              top: place.arrowY,
              transform: [
                {
                  translateY: nudge.interpolate({
                    inputRange: [0, 1],
                    outputRange: place.placement === 'below' ? [6, -2] : [-6, 2],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons
            name={place.placement === 'below' ? 'arrow-up' : 'arrow-down'}
            size={30}
            color="#FFFFFF"
          />
        </Animated.View>
      ) : null}

      <View
        onLayout={(event) => setBubbleHeight(event.nativeEvent.layout.height)}
        accessibilityLiveRegion="polite"
        style={[
          styles.bubble,
          {
            top: place ? place.top : Math.max(insets.top + 16, (height - bubbleHeight) / 2),
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <BubbleContent step={step} index={index} total={total} showNext={!step.action || missing} />
      </View>
    </Animated.View>
  );
}

/**
 * Lo de dentro del bocadillo: título y texto (entran con un fundido y un pequeño
 * desplazamiento al cambiar de paso), la barra de progreso, «Siguiente» y «Saltar».
 * Memorizado: solo se vuelve a pintar al cambiar de paso, no con cada fotograma del foco.
 */
const BubbleContent = memo(function BubbleContent({
  step,
  index,
  total,
  showNext,
}: {
  step: Step;
  index: number;
  total: number;
  showNext: boolean;
}) {
  const colors = useThemeColors();
  const [textIn] = useState(() => new Animated.Value(0));
  useEffect(() => {
    textIn.setValue(0);
    Animated.timing(textIn, {
      toValue: 1,
      duration: 650,
      delay: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [textIn, step.id]);

  return (
    <>
      <Animated.View
        style={[
          styles.bubbleText,
          {
            opacity: textIn,
            transform: [
              { translateX: textIn.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
            ],
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {step.title}
        </Text>
        <Text style={[styles.text, { color: colors.textMuted }]}>{step.text}</Text>
      </Animated.View>
      <View style={styles.footer}>
        <Progress index={index} total={total} style={styles.progressInBubble} />
        {/* Pasos que solo enseñan algo (o sin el elemento en pantalla): «Siguiente». */}
        {showNext ? <AppButton small title="Siguiente" onPress={continueTutorial} /> : null}
        <Pressable
          onPress={skipTutorial}
          accessibilityRole="button"
          accessibilityLabel="Saltar el tutorial"
          hitSlop={10}
          style={styles.skip}
        >
          <Text style={[styles.skipText, { color: colors.textMuted }]}>Saltar</Text>
        </Pressable>
      </View>
    </>
  );
});

/** Zona que se traga los toques (para que solo funcione el hueco o el bocadillo). */
function Blocker({ style }: { style: object }) {
  return <View style={[styles.blocker, style]} onStartShouldSetResponder={() => true} />;
}

// Último punto de la barra que se ha enseñado: el paso siguiente anima desde ahí.
let shownProgress = 0;
const DOT = 14;

/**
 * Barra de pasos. Lo ya hecho es barra rellena; el paso actual, una bolita de color (más
 * grande), y los que faltan, bolitas huecas. Al completar un paso la barra avanza hasta el
 * siguiente: la bolita que se deja se funde en la barra y la nueva se llena y crece.
 */
const Progress = memo(function Progress({
  index,
  total,
  style,
}: {
  index: number;
  total: number;
  style?: object;
}) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const [progress] = useState(() => new Animated.Value(Math.min(shownProgress, index)));
  useEffect(() => {
    shownProgress = index;
    Animated.timing(progress, {
      toValue: index,
      duration: 1100,
      delay: 200,
      easing: Easing.inOut(Easing.cubic),
      // Anima ancho y color: no se puede con el driver nativo.
      useNativeDriver: false,
    }).start();
  }, [progress, index]);

  const last = Math.max(total - 1, 1);
  const track = Math.max(0, width - DOT);
  return (
    <View
      style={[styles.progress, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Paso ${Math.min(index + 1, total)} de ${total}`}
    >
      <View
        style={[styles.track, { left: DOT / 2, right: DOT / 2, backgroundColor: colors.border }]}
      />
      <Animated.View
        style={[
          styles.track,
          styles.trackFill,
          {
            left: DOT / 2,
            backgroundColor: colors.primary,
            width: progress.interpolate({
              inputRange: [0, last],
              outputRange: [0, track],
              extrapolate: 'clamp',
            }),
          },
        ]}
      />
      {Array.from({ length: total }, (_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.progressDot,
            {
              width: DOT,
              height: DOT,
              borderRadius: DOT / 2,
              left: (i / last) * track,
              borderColor: progress.interpolate({
                inputRange: [i - 1, i],
                outputRange: [colors.border, colors.primary],
                extrapolate: 'clamp',
              }),
              backgroundColor: progress.interpolate({
                inputRange: [i - 1, i],
                outputRange: [colors.surface, colors.primary],
                extrapolate: 'clamp',
              }),
              // Pendiente → actual (crece) → hecho (se funde en la barra).
              opacity: progress.interpolate({
                inputRange: [i, i + 0.7],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  scale: progress.interpolate({
                    inputRange: [i - 1, i, i + 0.7],
                    outputRange: [0.75, 1.25, 0.3],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  welcome: { paddingHorizontal: 24, zIndex: 1000, elevation: 1000 },
  welcomeBody: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', gap: 16 },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: { fontSize: 48, fontFamily: fonts.display },
  welcomeTitle: { fontSize: 30, fontFamily: fonts.display, textAlign: 'left' },
  welcomeSubtitle: { fontSize: 19, fontFamily: fonts.title, textAlign: 'left' },
  welcomeText: { fontSize: 17, fontFamily: fonts.detail, textAlign: 'left', lineHeight: 24 },
  welcomeButtons: { gap: 8 },
  bannerLayer: { justifyContent: 'center', alignItems: 'center' },
  banner: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  bannerText: { fontSize: 22, fontFamily: fonts.title },
  layer: { zIndex: 1000, elevation: 1000 },
  blocker: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 3 },
  arrow: { position: 'absolute', width: 30, alignItems: 'center' },
  bubbleText: { gap: 8 },
  bubble: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  title: { fontSize: 18, fontFamily: fonts.title },
  text: { fontSize: 15, fontFamily: fonts.detail, lineHeight: 21 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 12,
  },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  skip: { minHeight: 44, justifyContent: 'center' },
  skipText: { fontSize: 15, fontFamily: fonts.title },
  progress: { height: 14, justifyContent: 'center', alignSelf: 'stretch' },
  progressInBubble: { flex: 1 },
  track: { position: 'absolute', height: 3, borderRadius: 2 },
  progressDot: { position: 'absolute', borderWidth: 2 },
  trackFill: { height: 4, borderRadius: 2 },
  finish: { paddingHorizontal: 24, zIndex: 1000, elevation: 1000 },
  finishBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  finishTitle: { fontSize: 34, fontFamily: fonts.display, textAlign: 'center' },
  finishText: { fontSize: 18, fontFamily: fonts.detail, textAlign: 'center', lineHeight: 25 },
  finishBottom: { alignItems: 'center', gap: 12 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2 },
  print: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdHint: { fontSize: 14, fontFamily: fonts.detail },
  promise: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  brandText: { fontSize: 44, fontFamily: fonts.display, textAlign: 'center' },
  promiseText: { fontSize: 26, fontFamily: fonts.display, textAlign: 'center', lineHeight: 34 },
});

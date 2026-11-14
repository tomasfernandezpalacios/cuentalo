import { router, usePathname } from 'expo-router';
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { displayFont, fonts, proseFont, titleFont, useThemeColors } from '@/lib/theme';

import { SMOOTH, SOFT_OUT, tick, useLoop } from './animations';
import {
  bubbleOutside,
  centerOf,
  closedHole,
  type Edges,
  holeFor,
  isClosed,
  movedEnough,
  placeBubble,
  type Rect,
  screenHole,
  HOLE_RADIUS,
} from './layout';
import { Progress } from './Progress';
import {
  advancesOnScreen,
  letsTouchTarget,
  showsNext,
  stepKind,
  stepScreen,
  type Step,
  type TargetId,
} from './steps';
import {
  continueTutorial,
  getTarget,
  goToStep,
  nextStep,
  skipTutorial,
  type ViewRef,
} from './store';

// El tutorial apaga la app con un velo y deja un hueco sobre lo que enseña.
//
// Para que todo vaya fluido, nada se mueve desde JavaScript fotograma a fotograma: el velo son
// piezas sólidas (cuatro paneles y cuatro esquinas redondeadas) que solo se desplazan y estiran
// con el motor nativo (transform), así no se ven afectadas aunque la app esté ocupada cargando
// datos o cambiando de pantalla. Las piezas son opacas y se apagan juntas con la opacidad del
// grupo, por eso, aunque se solapen, el velo es siempre del mismo tono.

const VEIL_COLOR = '#050508';
const VEIL_OPACITY = 0.72;
/** Lo que tarda el foco en ir de un sitio a otro. */
const GLIDE_MS = 680;
/** Retoque cuando el elemento se mueve un poco (p. ej. la lista se recoloca). */
const NUDGE_MS = 300;
/** Cada cuánto se mide el elemento hasta que se queda quieto, y después mientras está. */
const POLL_MS = 90;
const WATCH_MS = 450;
/** Si el elemento no aparece en este tiempo, el paso se explica sin foco (con «Siguiente»). */
const MISSING_MS = 5000;
/** Espera a que una pestaña termine de deslizarse antes de iluminar la pantalla entera. */
const PAGE_SETTLE_MS = 380;
/** Lo que ocupan la cabecera y la barra de pestañas (para iluminar la pantalla entera). */
const HEADER_SPACE = 64;
const TAB_BAR_SPACE = 64 + 12 + 10;
const CARET = 14;
/** Solape entre las piezas del velo. */
const SEAM = 1;
/** Lo que tarda el hueco en cerrarse al cambiar de pantalla. */
const CLOSE_MS = 320;

type Size = { width: number; height: number };

/** Lo que enseña ahora el bocadillo: un paso, dónde está su hueco y si su elemento faltaba. */
type Shown = { step: Step; index: number; edges: Edges; missing: boolean; token: number };

function measureTarget(layer: ViewRef, id: TargetId, done: (rect: Rect | null) => void) {
  const view = getTarget(id);
  if (!view) {
    done(null);
    return;
  }
  // Las dos medidas en coordenadas de la ventana y restadas: la capa del tutorial y la ventana
  // no empiezan en el mismo sitio en Android (barra de estado, edge-to-edge…).
  layer.measureInWindow((ox, oy) => {
    view.measureInWindow((x, y, width, height) => {
      done(width > 0 && height > 0 ? { x: x - ox, y: y - oy, width, height } : null);
    });
  });
}

/**
 * Velo, foco y bocadillo de todos los pasos que no son a pantalla completa. Se monta una sola
 * vez para todo el tutorial (nunca se desmonta entre pasos): de un paso al siguiente, el foco se
 * desliza, el bocadillo se funde y vuelve a aparecer junto al nuevo foco.
 */
export function Coach({ step, index, total }: { step: Step; index: number; total: number }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const pathname = usePathname();
  const [layer, setLayer] = useState<ViewRef | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [anim] = useState(() => ({
    left: new Animated.Value(0),
    top: new Animated.Value(0),
    right: new Animated.Value(0),
    bottom: new Animated.Value(0),
    veil: new Animated.Value(0),
    bubble: new Animated.Value(0),
    bubbleY: new Animated.Value(0),
    caretX: new Animated.Value(0),
    ring: new Animated.Value(0),
    banner: new Animated.Value(0),
  }));
  const [shown, setShown] = useState<Shown | null>(null);
  const [bubbleHeight, setBubbleHeight] = useState(0);
  const edgesRef = useRef<Edges | null>(null);
  const tokenRef = useRef(0);
  /** Pantalla del último foco: si el paso nuevo es en otra, el hueco se cierra antes (iris). */
  const screenRef = useRef<string | null>(null);
  const revealedRef = useRef(-1);
  const pulse = useLoop(1100);

  const kind = stepKind(step);
  const fullScreen = kind === 'welcome' || kind === 'finish';
  // La bienvenida y el final se anuncian solos; aquí, el resto de pasos.
  useEffect(() => {
    if (!fullScreen) AccessibilityInfo.announceForAccessibility(`${step.title}. ${step.text}`);
  }, [step, fullScreen]);
  const onScreen = pathname === stepScreen(step);
  const width = size?.width ?? window.width;
  const height = size?.height ?? window.height;
  const screen = { width, height, top: insets.top, bottom: insets.bottom };

  // El velo aparece al empezar el tutorial con el hueco cerrado en el centro.
  useLayoutEffect(() => {
    if (!size || edgesRef.current) return;
    const closed = closedHole(size.width / 2, size.height / 2);
    edgesRef.current = closed;
    anim.left.setValue(closed.left);
    anim.top.setValue(closed.top);
    anim.right.setValue(closed.right);
    anim.bottom.setValue(closed.bottom);
    Animated.timing(anim.veil, {
      toValue: 1,
      duration: 500,
      easing: SOFT_OUT,
      useNativeDriver: true,
    }).start();
  }, [size, anim]);

  // Pasos de pestaña: al llegar a la pantalla (tocando la pestaña iluminada), se sigue.
  useEffect(() => {
    if (advancesOnScreen(step, pathname)) nextStep();
  }, [step, pathname]);

  // Cada paso va a su pantalla (salvo a las que llega el propio usuario, como el formulario).
  useEffect(() => {
    if (kind === 'spotlight' && !step.userNavigates) router.navigate(stepScreen(step));
  }, [step, kind]);

  // Si el usuario sale a medias de la pantalla del paso (p. ej. vuelve atrás desde el
  // formulario), el tutorial vuelve al paso desde el que se llega a ella.
  useEffect(() => {
    if (!step.fallback || onScreen) return;
    const fallback = step.fallback;
    const timer = setTimeout(() => goToStep(fallback), 800);
    return () => clearTimeout(timer);
  }, [step, onScreen]);

  // Un toque muy leve en cada paso nuevo.
  useEffect(() => {
    if (index > 0) tick();
  }, [index]);

  /** Desliza el foco a unos bordes nuevos (en el hilo nativo). */
  function glideTo(edges: Edges, duration = GLIDE_MS) {
    edgesRef.current = edges;
    Animated.parallel(
      (['left', 'top', 'right', 'bottom'] as const).map((key) =>
        Animated.timing(anim[key], {
          toValue: edges[key],
          duration,
          easing: duration === NUDGE_MS ? SOFT_OUT : SMOOTH,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }

  function fade(value: Animated.Value, toValue: number, duration: number, delay = 0) {
    Animated.timing(value, {
      toValue,
      duration,
      delay,
      easing: SOFT_OUT,
      useNativeDriver: true,
    }).start();
  }

  // Cada paso: se va el bocadillo, se busca el elemento (cuando ya está en su pantalla y quieto)
  // y el foco se desliza hasta él; el bocadillo vuelve a aparecer en su sitio.
  useEffect(() => {
    if (!size || !layer) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    const center = closedHole(size.width / 2, size.height / 2);

    fade(anim.bubble, 0, 160);
    fade(anim.ring, 0, 140);
    if (kind !== 'banner') fade(anim.banner, 0, 220);

    if (fullScreen || kind === 'banner') {
      // Todo apagado: el hueco se cierra en el centro. En «Esto es Cuéntalo», el rótulo aparece
      // encima, destacado sobre la app apagada.
      glideTo(center);
      if (kind === 'banner') {
        anim.banner.setValue(0);
        Animated.spring(anim.banner, {
          toValue: 1,
          delay: 350,
          friction: 9,
          tension: 60,
          useNativeDriver: true,
        }).start();
        later(nextStep, step.autoAdvanceMs ?? 2400);
      }
      return () => timers.forEach(clearTimeout);
    }
    // Otra pantalla: el hueco se cierra donde estaba mientras la pantalla cambia, y se abrirá
    // sobre el elemento nuevo.
    const stepScreenPath = stepScreen(step);
    if (screenRef.current !== null && screenRef.current !== stepScreenPath) {
      const edges = edgesRef.current;
      if (edges && !isClosed(edges)) glideTo(closeAt(edges), CLOSE_MS);
    }
    if (!onScreen) return () => timers.forEach(clearTimeout);

    const token = ++tokenRef.current;
    const show = (edges: Edges, missing: boolean) => {
      if (cancelled) return;
      screenRef.current = stepScreenPath;
      glideTo(edges);
      setShown({ step, index, edges, missing, token });
    };

    if (step.target === 'pantalla') {
      later(
        () => show(screenHole(screen, HEADER_SPACE, insets.bottom + TAB_BAR_SPACE), false),
        PAGE_SETTLE_MS,
      );
      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
      };
    }
    const target = step.target;
    if (!target) {
      show(center, true);
      return () => {
        cancelled = true;
      };
    }

    // Medir hasta que el elemento esté quieto (dos medidas iguales seguidas): así el foco no va
    // a parar a mitad de una animación de la pantalla.
    const startedAt = Date.now();
    let last: Rect | null = null;
    let found: Rect | null = null;
    let watcher: ReturnType<typeof setInterval> | null = null;
    const poll = () => {
      if (cancelled) return;
      measureTarget(layer, target, (rect) => {
        if (cancelled) return;
        if (!rect) {
          if (Date.now() - startedAt > MISSING_MS) show(center, true);
          else later(poll, POLL_MS);
          return;
        }
        if (!last || movedEnough(last, rect)) {
          last = rect;
          later(poll, POLL_MS);
          return;
        }
        found = rect;
        show(holeFor(rect), false);
        // Mientras dura el paso, si el elemento se mueve un poco, el foco lo acompaña.
        watcher = setInterval(() => {
          measureTarget(layer, target, (next) => {
            if (cancelled || !next || !found || !movedEnough(found, next, 2)) return;
            found = next;
            const edges = holeFor(next);
            glideTo(edges, NUDGE_MS);
            setShown((old) => (old && old.token === token ? { ...old, edges } : old));
          });
        }, WATCH_MS);
      });
    };
    poll();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      if (watcher) clearInterval(watcher);
    };
    // `screen` e `insets` cambian de objeto en cada render: basta con el tamaño.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, kind, fullScreen, onScreen, size, layer, anim]);

  // Dónde va el bocadillo (si ya se sabe su alto).
  // `shown` sigue siendo el paso anterior mientras su bocadillo se funde; `current`, solo si ya es
  // el paso actual (entonces se puede tocar su hueco).
  const current = shown && shown.step === step ? shown : null;
  const shownClosed = shown ? shown.missing || isClosed(shown.edges) : true;
  const closed = current ? shownClosed : true;
  const place =
    shown && bubbleHeight > 0
      ? shownClosed
        ? { placement: 'above' as const, top: (height - bubbleHeight) / 2, caretX: width / 2 }
        : placeBubble(shown.edges, bubbleHeight, screen)
      : null;
  const withCaret =
    shown && place && !shownClosed ? bubbleOutside(shown.edges, place, bubbleHeight) : false;
  const placeTop = place?.top;
  const caretX = place?.caretX;
  const token = shown?.token;

  // El bocadillo aparece (o se recoloca) cuando ya se sabe dónde va.
  useEffect(() => {
    if (placeTop === undefined || caretX === undefined || token === undefined) return;
    const caret = caretX - 16 - CARET / 2;
    if (revealedRef.current !== token) {
      // Paso nuevo: aparece desde un poco más abajo, en la segunda mitad del deslizamiento.
      revealedRef.current = token;
      anim.bubbleY.setValue(placeTop + 14);
      anim.caretX.setValue(caret);
      Animated.parallel([
        Animated.timing(anim.bubble, {
          toValue: 1,
          duration: 420,
          delay: GLIDE_MS * 0.45,
          easing: SOFT_OUT,
          useNativeDriver: true,
        }),
        Animated.timing(anim.bubbleY, {
          toValue: placeTop,
          duration: 520,
          delay: GLIDE_MS * 0.45,
          easing: SOFT_OUT,
          useNativeDriver: true,
        }),
      ]).start();
      fade(anim.ring, 1, 380, GLIDE_MS);
      return;
    }
    // Mismo paso, el foco se ha movido un poco: el bocadillo lo acompaña.
    Animated.parallel([
      Animated.timing(anim.bubbleY, {
        toValue: placeTop,
        duration: NUDGE_MS,
        easing: SOFT_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(anim.caretX, {
        toValue: caret,
        duration: NUDGE_MS,
        easing: SOFT_OUT,
        useNativeDriver: true,
      }),
    ]).start();
  }, [placeTop, caretX, token, anim]);

  /** «Saltar»: todo se funde y se termina. */
  function leave() {
    Animated.parallel([
      Animated.timing(anim.veil, { toValue: 0, duration: 320, useNativeDriver: true }),
      Animated.timing(anim.bubble, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(anim.ring, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => skipTutorial());
  }

  function onBubbleLayout(event: LayoutChangeEvent) {
    const next = Math.round(event.nativeEvent.layout.height);
    setBubbleHeight((old) => (Math.abs(old - next) < 2 ? old : next));
  }

  // Lo que se puede tocar: el hueco en los pasos de acción y de pestaña (ya colocado); nada
  // mientras se pasa de un paso a otro.
  const touchHole = current && !closed && letsTouchTarget(step) ? current.edges : null;
  const ringEdges = touchHole;

  return (
    <View
      ref={setLayer}
      collapsable={false}
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, styles.layer]}
      onLayout={(event) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        setSize((old) =>
          old && old.width === w && old.height === h ? old : { width: w, height: h },
        );
      }}
    >
      {size ? <Veil anim={anim} size={size} /> : null}

      {/* Lo que no se puede tocar. */}
      {touchHole ? (
        <>
          <Blocker style={{ left: 0, right: 0, top: 0, height: Math.max(0, touchHole.top) }} />
          <Blocker style={{ left: 0, right: 0, top: touchHole.bottom, bottom: 0 }} />
          <Blocker
            style={{
              left: 0,
              width: Math.max(0, touchHole.left),
              top: touchHole.top,
              height: touchHole.bottom - touchHole.top,
            }}
          />
          <Blocker
            style={{
              left: touchHole.right,
              right: 0,
              top: touchHole.top,
              height: touchHole.bottom - touchHole.top,
            }}
          />
        </>
      ) : (
        <Blocker style={StyleSheet.absoluteFill} />
      )}

      {/* Anillo que late alrededor de lo que hay que tocar. */}
      {ringEdges ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              left: ringEdges.left - 3,
              top: ringEdges.top - 3,
              width: ringEdges.right - ringEdges.left + 6,
              height: ringEdges.bottom - ringEdges.top + 6,
              borderColor: colors.primary,
              opacity: Animated.multiply(
                anim.ring,
                pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
              ),
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
              ],
            },
          ]}
        />
      ) : null}

      {/* «Esto es Cuéntalo»: destacado en el centro, con todo lo demás apagado. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bannerBox,
          {
            opacity: anim.banner,
            transform: [
              { scale: anim.banner.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
            ],
          },
        ]}
      >
        <View
          style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.primary }]}
        >
          <Text style={[styles.bannerText, { color: colors.text }]}>
            {kind === 'banner' ? step.title : 'Esto es Cuéntalo'}
          </Text>
        </View>
      </Animated.View>

      {/* Bocadillo: aparece junto al foco con su piquito apuntándolo. */}
      {shown ? (
        <Animated.View
          onLayout={onBubbleLayout}
          accessibilityLiveRegion="polite"
          // Solo se puede tocar el bocadillo del paso actual: el que se está fundiendo, no (un
          // segundo toque en «Siguiente» se saltaría un paso).
          pointerEvents={current ? 'box-none' : 'none'}
          style={[
            styles.bubble,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: anim.bubble,
              transform: [{ translateY: anim.bubbleY }],
            },
          ]}
        >
          {withCaret && place ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.caret,
                place.placement === 'below' ? styles.caretTop : styles.caretBottom,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  transform: [{ translateX: anim.caretX }, { rotate: '45deg' }],
                },
              ]}
            />
          ) : null}
          <BubbleContent
            step={shown.step}
            index={shown.index}
            total={total}
            showNext={showsNext(shown.step, shown.missing)}
            onSkip={leave}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * El velo: cuatro paneles alrededor del hueco y cuatro esquinas redondeadas, todos del mismo
 * color opaco dentro de un grupo semitransparente (needsOffscreenAlphaCompositing: el grupo se
 * apaga entero de una vez, así los solapes no se ven más oscuros).
 */
const Veil = memo(function Veil({
  anim,
  size,
}: {
  anim: Record<'left' | 'top' | 'right' | 'bottom' | 'veil', Animated.Value>;
  size: Size;
}) {
  const { width, height } = size;
  const big = Math.max(width, height) * 2;
  // Las piezas se solapan 1 px (SEAM): sin eso, el suavizado de bordes deja una línea finísima
  // más clara donde se juntan dos.
  const holeHeight = Animated.add(Animated.subtract(anim.bottom, anim.top), SEAM * 2);
  const middleY = Animated.subtract(
    Animated.multiply(Animated.add(anim.top, anim.bottom), 0.5),
    0.5,
  );
  const r = HOLE_RADIUS;
  return (
    <Animated.View
      pointerEvents="none"
      needsOffscreenAlphaCompositing
      style={[StyleSheet.absoluteFill, { opacity: Animated.multiply(anim.veil, VEIL_OPACITY) }]}
    >
      {/* Arriba y abajo: de lado a lado. */}
      <Animated.View
        style={[
          styles.panel,
          {
            width,
            height: big,
            transform: [{ translateY: Animated.subtract(anim.top, big - SEAM) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.panel,
          { width, height: big, transform: [{ translateY: Animated.subtract(anim.bottom, SEAM) }] },
        ]}
      />
      {/* Izquierda y derecha: solo a la altura del hueco (una franja de 1 px estirada). */}
      <Animated.View
        style={[
          styles.panel,
          {
            width,
            height: 1,
            transform: [
              { translateX: Animated.subtract(anim.left, width - SEAM) },
              { translateY: middleY },
              { scaleY: holeHeight },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.panel,
          {
            width,
            height: 1,
            transform: [
              { translateX: Animated.subtract(anim.right, SEAM) },
              { translateY: middleY },
              { scaleY: holeHeight },
            ],
          },
        ]}
      />
      {/* Esquinas: cuadrados de r × r con un cuarto de círculo transparente. */}
      <Corner x={anim.left} y={anim.top} cx={r} cy={r} />
      <Corner x={Animated.subtract(anim.right, r)} y={anim.top} cx={0} cy={r} />
      <Corner x={anim.left} y={Animated.subtract(anim.bottom, r)} cx={r} cy={0} />
      <Corner
        x={Animated.subtract(anim.right, r)}
        y={Animated.subtract(anim.bottom, r)}
        cx={0}
        cy={0}
      />
    </Animated.View>
  );
});

type AnimatedNumber =
  Animated.Value | Animated.AnimatedInterpolation<number> | ReturnType<typeof Animated.subtract>;

/**
 * Una esquina del hueco: un cuadrado opaco con un cuarto de círculo de radio r recortado
 * alrededor de (cx, cy). El círculo es un aro grueso (borde) cuyo hueco es el círculo.
 */
function Corner({
  x,
  y,
  cx,
  cy,
}: {
  x: AnimatedNumber;
  y: AnimatedNumber;
  cx: number;
  cy: number;
}) {
  const r = HOLE_RADIUS;
  const ring = r * 2 + r * 2;
  return (
    <Animated.View
      style={[
        styles.corner,
        { width: r, height: r, transform: [{ translateX: x }, { translateY: y }] },
      ]}
    >
      <View
        style={{
          position: 'absolute',
          left: cx - ring / 2,
          top: cy - ring / 2,
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          borderWidth: r,
          borderColor: VEIL_COLOR,
        }}
      />
    </Animated.View>
  );
}

/**
 * Lo de dentro del bocadillo: título y texto, la barra de progreso, «Siguiente» y «Saltar».
 * Memorizado: solo se vuelve a pintar al cambiar de paso.
 */
const BubbleContent = memo(function BubbleContent({
  step,
  index,
  total,
  showNext,
  onSkip,
}: {
  step: Step;
  index: number;
  total: number;
  showNext: boolean;
  onSkip: () => void;
}) {
  const colors = useThemeColors();
  return (
    <>
      <View style={styles.bubbleText}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {step.title}
        </Text>
        <Text style={[styles.text, { color: colors.textMuted }]}>{step.text}</Text>
      </View>
      <View style={styles.footer}>
        <Progress index={index} total={total} style={styles.progressInBubble} />
        {showNext ? <AppButton small title="Siguiente" onPress={continueTutorial} /> : null}
        <Pressable
          onPress={onSkip}
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

/** Centro de unos bordes (para cerrar el hueco donde estaba). */
export function closeAt(edges: Edges): Edges {
  const c = centerOf(edges);
  return closedHole(c.x, c.y);
}

const styles = StyleSheet.create({
  layer: { zIndex: 1000, elevation: 1000 },
  panel: { position: 'absolute', left: 0, top: 0, backgroundColor: VEIL_COLOR },
  corner: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  blocker: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 2, borderRadius: HOLE_RADIUS + 3 },
  bannerBox: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  bannerText: { ...displayFont(26) },
  bubble: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  caret: {
    position: 'absolute',
    left: 0,
    width: CARET,
    height: CARET,
    borderWidth: 1,
  },
  // El piquito asoma por arriba o por abajo (medio cuadrado girado, con el borde por fuera).
  caretTop: { top: -CARET / 2, borderRightWidth: 0, borderBottomWidth: 0 },
  caretBottom: { bottom: -CARET / 2, borderLeftWidth: 0, borderTopWidth: 0 },
  bubbleText: { gap: 6 },
  title: { ...titleFont(18) },
  text: { ...proseFont(15, 21) },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  skip: { minHeight: 44, justifyContent: 'center' },
  skipText: { fontSize: 15, fontFamily: fonts.title },
  progressInBubble: { flex: 1 },
});

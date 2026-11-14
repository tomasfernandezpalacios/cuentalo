import { memo, useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedRef, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { displayFont, fonts, proseFont, titleFont, useThemeColors } from '@/lib/theme';

import { Demo } from './Demo';
import { Director } from './director';
import { SIDE_MARGIN } from './layout';
import { CARET, SEAM, VEIL_COLOR, VEIL_OPACITY, type Values } from './motion';
import { Progress } from './Progress';
import { letsTouchTarget, showsNext, stepKind, type Step } from './steps';
import { continueTutorial } from './store';

// El tutorial tapa la app con una demostración fija (Demo.tsx), la apaga con un velo y deja un
// hueco sobre lo que enseña. Solo responde lo iluminado y el bocadillo.
//
// Este componente solo dibuja: el velo, el anillo, el rótulo y el bocadillo leen sus valores
// animados (motion.ts) en el hilo de la interfaz, y lo que decide cada fase de cada paso está en
// el director (director.ts). Se vuelve a dibujar una o dos veces por paso, nunca por fotograma.

type Props = {
  step: Step;
  index: number;
  total: number;
};

/**
 * Velo, foco y bocadillo de todos los pasos. Se monta una sola vez para todo el tutorial (nunca
 * se desmonta entre pasos), también debajo de la bienvenida y del final.
 */
export function Coach({ step, index, total }: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const layerRef = useAnimatedRef<Animated.View>();
  const bubbleRef = useAnimatedRef<Animated.View>();
  const [director] = useState(() => new Director(window.width, window.height));
  const view = useSyncExternalStore(director.subscribe, director.getView);
  const v = director.values;

  useEffect(() => {
    director.mount(layerRef, bubbleRef);
    return () => director.dispose();
  }, [director, layerRef, bubbleRef]);
  useEffect(() => {
    director.setInsets(insets.top, insets.bottom);
  }, [director, insets.top, insets.bottom]);
  useEffect(() => {
    director.goTo(step, index);
  }, [director, step, index]);
  // El texto nuevo del bocadillo ya está dibujado: ya se puede medir su alto.
  useEffect(() => {
    director.contentCommitted(view.content);
  }, [director, view.content]);

  const active = view.active;
  const touchHole =
    active && !active.missing && stepKind(step) === 'spotlight' && letsTouchTarget(step)
      ? active.edges
      : null;
  const bubbleStep = view.content?.step ?? null;
  const kind = stepKind(step);

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: v.bubble.value,
    transform: [{ translateY: v.bubbleY.value }],
  }));
  const caretTopStyle = useAnimatedStyle(() => ({
    opacity: v.caretSide.value === 1 ? 1 : 0,
    transform: [{ translateX: v.caretX.value }, { rotate: '45deg' }],
  }));
  const caretBottomStyle = useAnimatedStyle(() => ({
    opacity: v.caretSide.value === 2 ? 1 : 0,
    transform: [{ translateX: v.caretX.value }, { rotate: '45deg' }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    left: v.ringX.value,
    top: v.ringY.value,
    width: v.ringW.value,
    height: v.ringH.value,
    borderRadius: v.ringR.value,
    opacity: v.ring.value * (1 - 0.6 * v.pulse.value),
    transform: [{ scale: 1 + 0.05 * v.pulse.value }],
  }));
  const bannerStyle = useAnimatedStyle(() => ({
    opacity: v.banner.value,
    transform: [{ scale: 0.94 + 0.06 * v.banner.value }],
  }));

  return (
    <Animated.View
      ref={layerRef}
      collapsable={false}
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, styles.layer]}
    >
      {/* La demostración (tapa la app de verdad: nada de ella se puede tocar). */}
      <Demo stepId={step.id} scene={view.content?.step.scene ?? step.scene} scenes={v.scenes} />

      <Veil v={v} width={window.width} height={window.height} />

      {/* Lo que no se puede tocar: todo, salvo el hueco en los pasos de acción ya a la vista. */}
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
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, { borderColor: colors.primary }, ringStyle]}
      />

      {/* «Esto es Cuéntalo»: destacado en el centro, con todo lo demás apagado. */}
      <Animated.View pointerEvents="none" style={[styles.bannerBox, bannerStyle]}>
        <View
          style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.primary }]}
        >
          <Text style={[styles.bannerText, { color: colors.text }]}>
            {kind === 'banner' ? step.title : 'Esto es Cuéntalo'}
          </Text>
        </View>
      </Animated.View>

      {/* Bocadillo: aparece junto al foco con su piquito apuntándolo. */}
      <Animated.View
        ref={bubbleRef}
        collapsable={false}
        accessibilityLiveRegion="polite"
        // Solo se puede tocar con el paso a la vista (un segundo toque en «Siguiente» mientras
        // se va se saltaría un paso).
        pointerEvents={active ? 'box-none' : 'none'}
        style={[
          styles.bubble,
          { backgroundColor: colors.surface, borderColor: colors.border },
          bubbleStyle,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.caret,
            styles.caretTop,
            { backgroundColor: colors.surface, borderColor: colors.border },
            caretTopStyle,
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.caret,
            styles.caretBottom,
            { backgroundColor: colors.surface, borderColor: colors.border },
            caretBottomStyle,
          ]}
        />
        {bubbleStep ? (
          <BubbleContent
            step={bubbleStep}
            index={view.progress}
            total={total}
            showNext={showsNext(bubbleStep, active?.missing ?? false)}
            onSkip={director.skip}
          />
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

/**
 * El velo: cuatro paneles alrededor del hueco y cuatro esquinas redondeadas, todos del mismo
 * color opaco dentro de un grupo semitransparente (needsOffscreenAlphaCompositing: el grupo se
 * apaga entero de una vez, así los solapes no se ven más oscuros). Las piezas solo se desplazan y
 * estiran (transform), en el hilo de la interfaz.
 */
const Veil = memo(function Veil({
  v,
  width,
  height,
}: {
  v: Values;
  width: number;
  height: number;
}) {
  const big = Math.max(width, height) * 2;
  // Las esquinas se dibujan a tamaño CORNER y se escalan al radio de cada hueco (escalar por
  // igual en los dos ejes mantiene el cuarto de círculo redondo). La escala es desde el centro:
  // por eso se corrige la posición con (r − CORNER) / 2.
  const corner = (x: number, y: number, radius: number) => {
    'worklet';
    const r = Math.max(radius, 0.01);
    return {
      transform: [
        { translateX: x + (r - CORNER) / 2 },
        { translateY: y + (r - CORNER) / 2 },
        { scale: r / CORNER },
      ],
    };
  };
  const group = useAnimatedStyle(() => ({ opacity: v.veil.value * VEIL_OPACITY }));
  const top = useAnimatedStyle(() => ({
    transform: [{ translateY: v.top.value - big + SEAM }],
  }));
  const bottom = useAnimatedStyle(() => ({
    transform: [{ translateY: v.bottom.value - SEAM }],
  }));
  // Izquierda y derecha: solo a la altura del hueco (una franja de 1 px estirada).
  const left = useAnimatedStyle(() => ({
    transform: [
      { translateX: v.left.value - width + SEAM },
      { translateY: (v.top.value + v.bottom.value) / 2 - 0.5 },
      { scaleY: v.bottom.value - v.top.value + SEAM * 2 },
    ],
  }));
  const right = useAnimatedStyle(() => ({
    transform: [
      { translateX: v.right.value - SEAM },
      { translateY: (v.top.value + v.bottom.value) / 2 - 0.5 },
      { scaleY: v.bottom.value - v.top.value + SEAM * 2 },
    ],
  }));
  const topLeft = useAnimatedStyle(() => corner(v.left.value, v.top.value, v.radius.value));
  const topRight = useAnimatedStyle(() =>
    corner(v.right.value - v.radius.value, v.top.value, v.radius.value),
  );
  const bottomLeft = useAnimatedStyle(() =>
    corner(v.left.value, v.bottom.value - v.radius.value, v.radius.value),
  );
  const bottomRight = useAnimatedStyle(() =>
    corner(v.right.value - v.radius.value, v.bottom.value - v.radius.value, v.radius.value),
  );
  return (
    <Animated.View
      pointerEvents="none"
      needsOffscreenAlphaCompositing
      style={[StyleSheet.absoluteFill, group]}
    >
      <Animated.View style={[styles.panel, { width, height: big }, top]} />
      <Animated.View style={[styles.panel, { width, height: big }, bottom]} />
      <Animated.View style={[styles.panel, { width, height: 1 }, left]} />
      <Animated.View style={[styles.panel, { width, height: 1 }, right]} />
      <Corner style={topLeft} cx={CORNER} cy={CORNER} />
      <Corner style={topRight} cx={0} cy={CORNER} />
      <Corner style={bottomLeft} cx={CORNER} cy={0} />
      <Corner style={bottomRight} cx={0} cy={0} />
    </Animated.View>
  );
});

/** Tamaño al que se dibujan las esquinas (después se escalan al radio de cada hueco). */
const CORNER = 64;

/**
 * Una esquina del hueco: un cuadrado opaco con un cuarto de círculo de radio r recortado
 * alrededor de (cx, cy). El círculo es un aro grueso (borde) cuyo hueco es el círculo.
 */
function Corner({
  style,
  cx,
  cy,
}: {
  style: ReturnType<typeof useAnimatedStyle>;
  cx: number;
  cy: number;
}) {
  const r = CORNER;
  const ring = r * 4;
  return (
    <Animated.View style={[styles.corner, { width: r, height: r }, style]}>
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

const styles = StyleSheet.create({
  layer: { zIndex: 1000, elevation: 1000 },
  panel: { position: 'absolute', left: 0, top: 0, backgroundColor: VEIL_COLOR },
  corner: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  blocker: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 2 },
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
    left: SIDE_MARGIN,
    right: SIDE_MARGIN,
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

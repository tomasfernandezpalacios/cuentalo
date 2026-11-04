import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
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
import Svg, { Path } from 'react-native-svg';

import { AppButton } from '@/components/AppButton';
import { fonts, useThemeColors } from '@/lib/theme';

import { dimPath, holeFor, placeBubble, type Rect } from './layout';
import type { Step } from './steps';
import { getTarget, nextStep, skipTutorial, useTutorial } from './store';

const DIM = 'rgba(8, 8, 16, 0.66)';
/** Si el elemento no aparece en este tiempo, el paso se enseña sin foco (con «Siguiente»). */
const TARGET_TIMEOUT_MS = 1500;
const MEASURE_EVERY_MS = 250;

/**
 * Tutorial de bienvenida: se monta una vez en el layout raíz (como DialogHost) y pinta el paso
 * actual por encima de la app. La bienvenida va a pantalla completa; el resto ilumina un
 * elemento (TutorialTarget) con un bocadillo, una flecha y un anillo que late. Solo se ve en
 * «Mis contadores»: si el usuario va a otra pantalla (p. ej. a crear el contador), se aparta.
 */
export function TutorialHost() {
  const { step, index, steps, celebrating } = useTutorial();
  const pathname = usePathname();
  if (!step || index === null) return null;
  if (!step.target) return <Welcome step={step} />;
  if (pathname !== '/') return null;
  return (
    <Spotlight
      key={step.id}
      step={step}
      index={index}
      total={steps.length}
      celebrating={celebrating}
    />
  );
}

/** Mide el elemento del paso cada poco (sigue al elemento si se mueve). */
function useTargetRect(step: Step): { rect: Rect | null; missing: boolean } {
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!step.target) return;
    const target = step.target;
    const startedAt = Date.now();
    const measure = () => {
      const view = getTarget(target);
      if (!view) {
        if (Date.now() - startedAt > TARGET_TIMEOUT_MS) setMissing(true);
        return;
      }
      view.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) return;
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
    };
    measure();
    const timer = setInterval(measure, MEASURE_EVERY_MS);
    return () => clearInterval(timer);
  }, [step.target]);

  return { rect, missing };
}

/** Aparición con fundido de cada paso. */
function useFadeIn() {
  const opacity = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }).start();
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

function Welcome({ step }: { step: Step }) {
  const colors = useThemeColors();
  const opacity = useFadeIn();
  const bounce = useLoop(900);
  useAnnounce(step);
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.welcome, { backgroundColor: DIM, opacity }]}
      accessibilityViewIsModal
    >
      <View style={[styles.welcomeCard, { backgroundColor: colors.surface }]}>
        <Animated.Text
          style={[
            styles.wave,
            {
              transform: [
                {
                  rotate: bounce.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['-12deg', '14deg'],
                  }),
                },
              ],
            },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          👋
        </Animated.Text>
        <Text style={[styles.welcomeTitle, { color: colors.text }]} accessibilityRole="header">
          {step.title}
        </Text>
        <Text style={[styles.welcomeText, { color: colors.textMuted }]}>{step.text}</Text>
        <AppButton title="Empezar" onPress={nextStep} />
        <AppButton title="Saltar" variant="ghost" onPress={skipTutorial} />
      </View>
    </Animated.View>
  );
}

type SpotlightProps = { step: Step; index: number; total: number; celebrating: boolean };

function Spotlight({ step, index, total, celebrating }: SpotlightProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { rect, missing } = useTargetRect(step);
  const [bubbleHeight, setBubbleHeight] = useState(170);
  const opacity = useFadeIn();
  const pulse = useLoop(800);
  const nudge = useLoop(550);
  useAnnounce(step);

  const screen = { width, height, top: insets.top, bottom: insets.bottom };
  // Sin elemento que iluminar (no está en pantalla): bocadillo en el centro y «Siguiente».
  const hole = rect && !missing ? holeFor(rect) : null;
  const isAction = Boolean(step.action) && hole !== null;
  const place = hole ? placeBubble(hole, bubbleHeight, screen) : null;

  if (!hole && !missing) {
    // Aún midiendo: solo el oscurecido, sin dejar tocar nada.
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} />;
  }

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.layer, { opacity }]}
      pointerEvents="box-none"
    >
      {hole ? (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d={dimPath(width, height, hole)} fill={DIM} fillRule="evenodd" />
        </Svg>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} pointerEvents="none" />
      )}

      {/* Lo que no se puede tocar: todo menos el hueco en los pasos de acción; todo en el resto. */}
      {isAction && hole ? (
        <>
          <Blocker style={{ left: 0, right: 0, top: 0, height: Math.max(0, hole.y) }} />
          <Blocker style={{ left: 0, right: 0, top: hole.y + hole.height, bottom: 0 }} />
          <Blocker
            style={{ left: 0, width: Math.max(0, hole.x), top: hole.y, height: hole.height }}
          />
          <Blocker
            style={{ left: hole.x + hole.width, right: 0, top: hole.y, height: hole.height }}
          />
        </>
      ) : (
        <Blocker style={StyleSheet.absoluteFill} />
      )}

      {hole ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              left: hole.x,
              top: hole.y,
              width: hole.width,
              height: hole.height,
              borderRadius: hole.radius,
              borderColor: colors.primary,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
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
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {step.title}
        </Text>
        <Text style={[styles.text, { color: colors.textMuted }]}>{step.text}</Text>
        <View style={styles.footer}>
          <Dots index={index} total={total} />
          <View style={styles.buttons}>
            <Pressable
              onPress={skipTutorial}
              accessibilityRole="button"
              accessibilityLabel="Saltar el tutorial"
              hitSlop={10}
              style={styles.skip}
            >
              <Text style={[styles.skipText, { color: colors.textMuted }]}>Saltar</Text>
            </Pressable>
            {isAction ? null : (
              <AppButton
                small
                title={index === total - 1 ? 'Terminar' : 'Siguiente'}
                onPress={nextStep}
              />
            )}
          </View>
        </View>
      </View>

      {celebrating && hole ? (
        <Confetti x={hole.x + hole.width / 2} y={hole.y + hole.height / 2} />
      ) : null}
    </Animated.View>
  );
}

/** Zona que se traga los toques (para que solo funcione el hueco o el bocadillo). */
function Blocker({ style }: { style: object }) {
  return <View style={[styles.blocker, style]} onStartShouldSetResponder={() => true} />;
}

function Dots({ index, total }: { index: number; total: number }) {
  const colors = useThemeColors();
  return (
    <View style={styles.dots} accessible accessibilityLabel={`Paso ${index + 1} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: i <= index ? colors.primary : colors.border },
            i === index && styles.dotCurrent,
          ]}
        />
      ))}
    </View>
  );
}

const CONFETTI = ['🎉', '✨', '⭐', '🎊', '💜', '✨', '🎉', '⭐', '🎊', '✨', '💜', '🎉'];

/** Pequeña celebración al hacer el primer registro: emoticonos que salen disparados. */
function Confetti({ x, y }: { x: number; y: number }) {
  const progress = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {CONFETTI.map((emoji, i) => {
        const angle = (i / CONFETTI.length) * Math.PI * 2;
        const distance = 70 + (i % 3) * 25;
        return (
          <Animated.Text
            key={i}
            style={[
              styles.confetti,
              {
                left: x - 12,
                top: y - 14,
                opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.cos(angle) * distance],
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.sin(angle) * distance - 30],
                    }),
                  },
                  {
                    scale: progress.interpolate({
                      inputRange: [0, 0.3, 1],
                      outputRange: [0.4, 1.2, 0.9],
                    }),
                  },
                ],
              },
            ]}
          >
            {emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  welcome: { justifyContent: 'center', padding: 24, zIndex: 1000, elevation: 1000 },
  welcomeCard: { borderRadius: 24, padding: 24, gap: 12, alignItems: 'stretch' },
  wave: { fontSize: 56, textAlign: 'center' },
  welcomeTitle: { fontSize: 24, fontFamily: fonts.title, textAlign: 'center' },
  welcomeText: {
    fontSize: 16,
    fontFamily: fonts.detail,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  layer: { zIndex: 1000, elevation: 1000 },
  blocker: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 3 },
  arrow: { position: 'absolute', width: 30, alignItems: 'center' },
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
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center', flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotCurrent: { width: 18 },
  confetti: { position: 'absolute', fontSize: 24 },
});

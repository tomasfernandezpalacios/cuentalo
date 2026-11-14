import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { displayFont, fonts, proseFont, useColorMode, useThemeColors } from '@/lib/theme';

import { haptic, SMOOTH, useAnnounce, useFadeIn, useLoop } from './animations';
import { Coach } from './Coach';
import { Progress } from './Progress';
import { stepKind, type Step } from './steps';
import { continueTutorial, nextStep, useTutorial } from './store';

/**
 * Tutorial de bienvenida: se monta una vez en el layout raíz (como DialogHost) y pinta el paso
 * actual por encima de la app. El velo con el foco y el bocadillo (`Coach`) está montado durante
 * todo el tutorial, también debajo de la bienvenida y de la pantalla final: así, de un paso a
 * otro nada desaparece de golpe, todo se desliza o se funde.
 */
export function TutorialHost() {
  const { step, index, steps, leaving } = useTutorial();
  if (!step || index === null) return null;
  const kind = stepKind(step);
  return (
    <>
      <Coach step={step} index={index} total={steps.length} leaving={leaving} />
      {kind === 'welcome' ? <Welcome step={step} index={index} total={steps.length} /> : null}
      {kind === 'finish' ? <Finish step={step} index={index} total={steps.length} /> : null}
    </>
  );
}

/** Primera pantalla: ocupa todo el dispositivo; abajo, la barra de progreso y «Seguir». */
function Welcome({ step, index, total }: { step: Step; index: number; total: number }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const opacity = useFadeIn();
  const float = useLoop(1400);
  const [leaving, setLeaving] = useState(false);
  useAnnounce(step);

  /** «Seguir»: la bienvenida se funde y deja ver la app ya apagada debajo. */
  function next() {
    if (leaving) return;
    setLeaving(true);
    Animated.timing(opacity, {
      toValue: 0,
      duration: 420,
      easing: SMOOTH,
      useNativeDriver: true,
    }).start(() => continueTutorial());
  }
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
        <AppButton title={step.button ?? 'Seguir'} onPress={next} />
      </View>
    </Animated.View>
  );
}

const HOLD_MS = 2600;
const CIRCLE = 104;

/**
 * Pantalla final: «Todo listo» y, abajo, un círculo con una huella. Mantenerlo pulsado hace
 * desaparecer la huella y crecer el círculo hasta llenar la pantalla; entonces sale «"Me
 * comprometo a registrar mi vida"» y se acaba el tutorial. Si se suelta antes, vuelve a su
 * tamaño (con un pequeño rebote) y la huella reaparece: se puede intentar las veces que haga
 * falta.
 */
function Finish({ step, index, total }: { step: Step; index: number; total: number }) {
  const colors = useThemeColors();
  // La promesa y «Cuéntalo»: blanco puro en oscuro y negro puro en claro (petición del usuario).
  const pureInk = useColorMode() === 'dark' ? '#FFFFFF' : '#000000';
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
          <Text style={[styles.promiseText, { color: pureInk, textShadowColor: pureInk }]}>
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
          <Text style={[styles.brandText, { color: pureInk, textShadowColor: pureInk }]}>
            Cuéntalo
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

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
  logoText: { ...displayFont(48) },
  welcomeTitle: { ...displayFont(30), textAlign: 'left' },
  welcomeSubtitle: { fontSize: 19, fontFamily: fonts.title, textAlign: 'left' },
  welcomeText: { ...proseFont(17, 24), textAlign: 'left' },
  welcomeButtons: { gap: 8 },
  finish: { paddingHorizontal: 24, zIndex: 1000, elevation: 1000 },
  finishBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  finishTitle: { ...displayFont(34), textAlign: 'center' },
  finishText: { ...proseFont(18, 25), textAlign: 'center' },
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
  brandText: { ...displayFont(44), textAlign: 'center' },
  promiseText: { ...displayFont(26), textAlign: 'center', lineHeight: 34 },
});

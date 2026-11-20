import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppButton } from '@/components/AppButton';
import { getSettings } from '@/features/configuracion/settings';
import { GestureMascot } from '@/features/mascota/GestureMascot';
import { displayFont, fonts, proseFont, shape, titleFont, useThemeColors } from '@/lib/theme';

import { closeLevelUp, confettiPieces, useLevelUp, type LevelUp } from '../levelUp';
import { rankOf } from '../ranks';
import { KIND_LABEL, type ShopItem } from '../shop';
import { CoinIcon } from './Bits';
import { ItemPreview } from './ItemPreview';
import { RankEmblem } from './RankEmblem';

// Tiempos de la celebración (ms desde que aparece).
const T_BADGE = 200; // la insignia entra con un rebote
const T_SWAP = 850; // el número viejo sale y entra el nuevo: estallido de confeti
const T_CANNONS = 1150; // confeti desde las esquinas de abajo
const T_TITLE = 1050; // título
const T_REWARDS = 1500; // premios, uno detrás de otro
const REWARD_STEP = 220;
// Cambio de rango (capítulo nuevo): el emblema viejo estalla y entra el nuevo detrás de la insignia.
const T_EMBLEM = 1250;
/** Lo que se retrasa el resto (título, premios) cuando cambia el rango. */
const TIER_DELAY = 1100;

const BADGE = 150;
const RAYS = 560;

function vibrate(kind: 'heavy' | 'success' | 'light') {
  if (!getSettings().haptics) return;
  const run =
    kind === 'success'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(
          kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light,
        );
  run.catch(() => {});
}

/** Rayos dorados que giran detrás de la insignia. */
function Rays({ color }: { color: string }) {
  const count = 14;
  const wedges = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    const b = a + Math.PI / count;
    const r = RAYS / 2;
    return `M 0 0 L ${Math.cos(a) * r} ${Math.sin(a) * r} L ${Math.cos(b) * r} ${Math.sin(b) * r} Z`;
  });
  return (
    <Svg width={RAYS} height={RAYS} viewBox={`${-RAYS / 2} ${-RAYS / 2} ${RAYS} ${RAYS}`}>
      {wedges.map((d) => (
        <Path key={d} d={d} fill={color} opacity={0.13} />
      ))}
    </Svg>
  );
}

/** Una tanda de confeti desde un punto (relativo al centro de la pantalla). */
function Confetti({
  origin,
  count,
  seed,
  start,
  cannon,
}: {
  origin: { x: number; y: number };
  count: number;
  seed: number;
  start: Animated.Value;
  /** Desde una esquina de abajo: −1 a la izquierda (dispara hacia arriba a la derecha), 1 a la derecha. */
  cannon?: -1 | 1;
}) {
  const [pieces] = useState(() =>
    confettiPieces(count, seed).map((p) =>
      cannon
        ? {
            ...p,
            dx: -cannon * Math.abs(p.dx) * 0.7,
            dy: -Math.abs(p.dy) * 1.9,
          }
        : p,
    ),
  );
  return (
    <>
      {pieces.map((p, i) => {
        const translateX = start.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: [origin.x, origin.x + p.dx, origin.x + p.dx * 1.25],
        });
        const translateY = start.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: [origin.y, origin.y + p.dy, origin.y + p.dy + p.fall],
        });
        const rotate = start.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.spin}deg`],
        });
        const opacity = start.interpolate({
          inputRange: [0, 0.02, 0.75, 1],
          outputRange: [0, 1, 1, 0],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                width: p.wide ? 12 : 7,
                height: p.wide ? 7 : 12,
                backgroundColor: p.color,
                opacity,
                transform: [{ translateX }, { translateY }, { rotate }],
              },
            ]}
          />
        );
      })}
    </>
  );
}

/**
 * Subir de nivel a pantalla completa (petición del usuario: «mucha más emoción»): la pantalla se
 * oscurece, unos rayos dorados giran, la insignia entra con un rebote con tu nivel de antes, el
 * número salta al nuevo con un estallido de confeti (y más desde las esquinas), la mascota lo
 * celebra, y los premios van apareciendo uno a uno con una vibración. Se monta una vez en las
 * pestañas.
 */
export function LevelUpCelebration() {
  const levelUp = useLevelUp();
  if (!levelUp) return null;
  return <Celebration key={levelUp.id} levelUp={levelUp} />;
}

/** Un premio de la celebración: monedas, protectores o algo de la tienda. */
type Reward =
  | { key: string; coins: number; label: string }
  | { key: string; shields: number }
  | { key: string; item: ShopItem };

function Celebration({ levelUp }: { levelUp: LevelUp }) {
  const colors = useThemeColors();
  // El rango al que llegas; si cambia de capítulo, se celebra como un capítulo nuevo de tu vida.
  const rank = rankOf(levelUp.to);
  const oldRank = rankOf(levelUp.from);
  const newTier = oldRank.tier.chapter !== rank.tier.chapter;
  const { width, height } = useWindowDimensions();
  const emblemSize = Math.min(280, width * 0.7);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [v] = useState(() => ({
    backdrop: new Animated.Value(0),
    rays: new Animated.Value(0),
    spin: new Animated.Value(0),
    badge: new Animated.Value(0),
    pulse: new Animated.Value(0),
    oldNumber: new Animated.Value(1),
    newNumber: new Animated.Value(0),
    burst: new Animated.Value(0),
    cannons: new Animated.Value(0),
    title: new Animated.Value(0),
    button: new Animated.Value(0),
    leave: new Animated.Value(1),
    // Cambio de rango.
    oldIn: new Animated.Value(0),
    implode: new Animated.Value(0),
    newIn: new Animated.Value(0),
    flash: new Animated.Value(0),
    wave1: new Animated.Value(0),
    wave2: new Animated.Value(0),
    burst2: new Animated.Value(0),
    shift: new Animated.Value(0),
  }));
  const rewards: Reward[] = [
    { key: 'coins', coins: levelUp.coins, label: 'monedas' },
    ...(levelUp.bonusCoins > 0
      ? [{ key: 'bonus', coins: levelUp.bonusCoins, label: 'de rango' }]
      : []),
    ...(levelUp.shields > 0 ? [{ key: 'shield', shields: levelUp.shields }] : []),
    ...levelUp.gifts.map((item) => ({ key: item.id, item })),
  ];
  const [rewardValues] = useState(() => rewards.map(() => new Animated.Value(0)));
  const [mascotOn, setMascotOn] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const native = { useNativeDriver: true };
    vibrate('heavy');
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    Animated.timing(v.backdrop, { toValue: 1, duration: 260, ...native }).start();
    Animated.timing(v.rays, {
      toValue: 1,
      duration: 700,
      delay: 120,
      easing: Easing.out(Easing.back(1.5)),
      ...native,
    }).start();
    const spin = Animated.loop(
      Animated.timing(v.spin, { toValue: 1, duration: 14000, easing: Easing.linear, ...native }),
    );
    spin.start();
    Animated.spring(v.badge, {
      toValue: 1,
      delay: T_BADGE,
      friction: 4,
      tension: 70,
      ...native,
    }).start();

    at(T_SWAP, () => {
      vibrate('success');
      setMascotOn(true);
      Animated.parallel([
        Animated.timing(v.oldNumber, { toValue: 0, duration: 220, ...native }),
        Animated.spring(v.newNumber, { toValue: 1, friction: 3.5, tension: 90, ...native }),
        Animated.timing(v.burst, {
          toValue: 1,
          duration: 1700,
          easing: Easing.out(Easing.quad),
          ...native,
        }),
      ]).start();
      Animated.loop(
        Animated.timing(v.pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.quad),
          ...native,
        }),
      ).start();
    });
    at(T_CANNONS, () =>
      Animated.timing(v.cannons, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.quad),
        ...native,
      }).start(),
    );
    // Cambio de rango: el emblema viejo aparece detrás, estalla con un destello y dos ondas, y
    // entra girando el nuevo; después la insignia baja para dejarlo a la vista.
    if (newTier) {
      Animated.spring(v.oldIn, {
        toValue: 1,
        delay: 150,
        friction: 6,
        tension: 50,
        ...native,
      }).start();
      at(T_EMBLEM, () => {
        vibrate('heavy');
        Animated.timing(v.implode, {
          toValue: 1,
          duration: 420,
          easing: Easing.in(Easing.back(2)),
          ...native,
        }).start();
        Animated.sequence([
          Animated.timing(v.flash, { toValue: 1, duration: 120, delay: 300, ...native }),
          Animated.timing(v.flash, { toValue: 0, duration: 500, ...native }),
        ]).start();
        Animated.timing(v.wave1, { toValue: 1, duration: 1000, delay: 340, ...native }).start();
        Animated.timing(v.wave2, { toValue: 1, duration: 1100, delay: 520, ...native }).start();
      });
      at(T_EMBLEM + 380, () => {
        vibrate('success');
        Animated.spring(v.newIn, { toValue: 1, friction: 4, tension: 55, ...native }).start();
        Animated.timing(v.burst2, {
          toValue: 1,
          duration: 1900,
          easing: Easing.out(Easing.quad),
          ...native,
        }).start();
      });
      at(T_EMBLEM + 900, () =>
        Animated.spring(v.shift, { toValue: 1, friction: 7, tension: 50, ...native }).start(),
      );
    }
    const delay = newTier ? TIER_DELAY : 0;
    at(T_TITLE + delay, () =>
      Animated.spring(v.title, { toValue: 1, friction: 6, tension: 60, ...native }).start(),
    );
    rewardValues.forEach((value, i) =>
      at(T_REWARDS + delay + i * REWARD_STEP, () => {
        vibrate('light');
        Animated.spring(value, { toValue: 1, friction: 5, tension: 80, ...native }).start();
      }),
    );
    at(T_REWARDS + delay + rewardValues.length * REWARD_STEP + 150, () =>
      Animated.timing(v.button, { toValue: 1, duration: 300, ...native }).start(),
    );

    return () => {
      timers.forEach(clearTimeout);
      spin.stop();
    };
  }, [v, rewardValues, newTier]);

  const close = () => {
    Animated.timing(v.leave, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
      closeLevelUp(),
    );
  };

  const spinDeg = v.spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const badgeScale = v.badge.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const center = { x: width / 2, y: height * (newTier ? 0.3 : 0.36) };
  // Con cambio de rango, la insignia baja hasta el pie del emblema y se hace más pequeña.
  const shiftDown = emblemSize / 2 - 6;
  const contentTop = newTier
    ? center.y + shiftDown + (BADGE * 0.62) / 2 + 16
    : center.y + BADGE / 2 + 28;
  const implodeOpacity = v.implode.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1, 0],
  });
  const emblemBox = {
    left: center.x - emblemSize / 2,
    top: center.y - emblemSize / 2,
  };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity: v.leave }]}
      accessibilityViewIsModal
      accessibilityLiveRegion="assertive"
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.background, opacity: Animated.multiply(v.backdrop, 0.96) },
        ]}
      />

      {/* Rayos que giran detrás de la insignia. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          {
            left: center.x - RAYS / 2,
            top: center.y - RAYS / 2,
            opacity: v.rays,
            transform: reduceMotion
              ? [{ scale: v.rays }]
              : [{ scale: v.rays }, { rotate: spinDeg }],
          },
        ]}
      >
        <Rays color={rank.tier.color} />
      </Animated.View>

      {newTier ? (
        <>
          {/* Ondas del estallido. */}
          {[v.wave1, v.wave2].map((wave, i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.abs,
                emblemBox,
                {
                  width: emblemSize,
                  height: emblemSize,
                  borderRadius: emblemSize / 2,
                  borderWidth: 4,
                  borderColor: rank.tier.color,
                  opacity: wave.interpolate({
                    inputRange: [0, 0.05, 1],
                    outputRange: [0, 0.9, 0],
                  }),
                  transform: [
                    { scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.2] }) },
                  ],
                },
              ]}
            />
          ))}
          {/* El emblema de antes: aparece, gira y estalla. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.abs,
              emblemBox,
              {
                opacity: Animated.multiply(v.oldIn, implodeOpacity),
                transform: [
                  {
                    scale: Animated.multiply(
                      v.oldIn.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                      v.implode.interpolate({
                        inputRange: [0, 0.35, 1],
                        outputRange: [1, 1.22, 0.05],
                      }),
                    ),
                  },
                  {
                    rotate: v.implode.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '-220deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <RankEmblem tier={oldRank.tier} size={emblemSize} />
          </Animated.View>
          {/* El nuevo: entra girando con un rebote. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.abs,
              emblemBox,
              {
                opacity: v.newIn.interpolate({
                  inputRange: [0, 0.15],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
                transform: [
                  { scale: v.newIn },
                  {
                    rotate: v.newIn.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['180deg', '0deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <RankEmblem tier={rank.tier} size={emblemSize} />
          </Animated.View>
          {!reduceMotion ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Confetti origin={center} count={70} seed={23} start={v.burst2} />
            </View>
          ) : null}
        </>
      ) : null}

      {/* Onda que late alrededor de la insignia. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          styles.ring,
          {
            left: center.x - BADGE / 2,
            top: center.y - BADGE / 2,
            borderColor: colors.primary,
            opacity: newTier
              ? 0
              : v.pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
            transform: [
              { scale: v.pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) },
            ],
          },
        ]}
      />

      {/* Insignia con el número: primero el de antes, luego salta al nuevo. */}
      <Animated.View
        style={[
          styles.abs,
          styles.badge,
          {
            left: center.x - BADGE / 2,
            top: center.y - BADGE / 2,
            backgroundColor: rank.tier.color,
            borderColor: colors.primarySoft,
            opacity: v.badge,
            transform: [
              {
                translateY: v.shift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, shiftDown],
                }),
              },
              {
                scale: Animated.multiply(
                  badgeScale,
                  v.shift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.62] }),
                ),
              },
            ],
          },
        ]}
      >
        <Text style={[styles.badgeLabel, { color: rank.tier.ink }]}>NIVEL</Text>
        <View style={styles.numberBox}>
          <Animated.Text
            style={[
              styles.number,
              {
                color: rank.tier.ink,
                opacity: v.oldNumber,
                transform: [
                  {
                    translateY: v.oldNumber.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-30, 0],
                    }),
                  },
                  { scale: v.oldNumber.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                ],
              },
            ]}
          >
            {levelUp.from}
          </Animated.Text>
          <Animated.Text
            style={[
              styles.number,
              {
                color: rank.tier.ink,
                opacity: v.newNumber.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0, 1, 1],
                  extrapolate: 'clamp',
                }),
                transform: [
                  { scale: v.newNumber.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] }) },
                ],
              },
            ]}
          >
            {levelUp.to}
          </Animated.Text>
        </View>
      </Animated.View>

      {/* La mascota lo celebra encima de la insignia. */}
      <View
        pointerEvents="none"
        style={[
          styles.abs,
          { left: 0, width, top: center.y - BADGE / 2 - 118, alignItems: 'center' },
        ]}
      >
        <GestureMascot name="cheer" radius={26} play={mascotOn && !newTier} />
      </View>

      {/* Confeti: un estallido desde la insignia y dos cañones desde abajo. */}
      {!reduceMotion ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Confetti origin={center} count={56} seed={7} start={v.burst} />
          <Confetti
            origin={{ x: 10, y: height - 40 }}
            count={30}
            seed={3}
            start={v.cannons}
            cannon={-1}
          />
          <Confetti
            origin={{ x: width - 10, y: height - 40 }}
            count={30}
            seed={11}
            start={v.cannons}
            cannon={1}
          />
        </View>
      ) : null}

      {/* Título, premios y botón. */}
      <View style={[styles.bottom, { top: contentTop }]}>
        <Animated.View
          style={{
            opacity: v.title,
            transform: [
              { translateY: v.title.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
            ],
          }}
        >
          {newTier ? (
            <Text style={[styles.kicker, { color: rank.tier.color }]}>
              {`NUEVO RANGO · CAPÍTULO ${rank.tier.chapter}`}
            </Text>
          ) : null}
          <Text style={[styles.title, { color: colors.text }]}>
            {newTier ? '¡Nuevo capítulo de tu vida!' : '¡Has subido de nivel!'}
          </Text>
          <Text
            style={[styles.rankLine, { color: rank.tier.color }]}
          >{`Ahora eres ${rank.name}`}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {newTier
              ? rank.tier.motto
              : levelUp.to - levelUp.from > 1
                ? `Del ${levelUp.from} al ${levelUp.to} de una tacada. Tu constancia se nota.`
                : 'Tu constancia se nota. Sigue así.'}
          </Text>
        </Animated.View>

        <View style={styles.rewards}>
          {rewards.map((reward, i) => {
            const value = rewardValues[i] ?? new Animated.Value(1);
            return (
              <Animated.View
                key={reward.key}
                style={[
                  styles.reward,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.primary,
                    opacity: value,
                    transform: [
                      {
                        translateY: value.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }),
                      },
                      { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                    ],
                  },
                ]}
              >
                {'coins' in reward ? (
                  <>
                    <CoinIcon size={28} />
                    <Text style={[styles.rewardText, { color: colors.text }]} numberOfLines={1}>
                      {`+${reward.coins} ${reward.label}`}
                    </Text>
                  </>
                ) : 'shields' in reward ? (
                  <>
                    <Ionicons name="shield" size={26} color="#F2C230" />
                    <Text style={[styles.rewardText, { color: colors.text }]} numberOfLines={1}>
                      {`+${reward.shields} protector`}
                    </Text>
                  </>
                ) : (
                  <>
                    <ItemPreview item={reward.item} size={44} />
                    <View style={styles.rewardTexts}>
                      <Text
                        style={[styles.rewardKind, { color: colors.primary }]}
                        numberOfLines={1}
                      >
                        {`Nuevo ${KIND_LABEL[reward.item.kind]}`}
                      </Text>
                      <Text style={[styles.rewardText, { color: colors.text }]} numberOfLines={1}>
                        {reward.item.name}
                      </Text>
                    </View>
                  </>
                )}
              </Animated.View>
            );
          })}
        </View>

        <Animated.View style={{ opacity: v.button }}>
          <AppButton title="¡A por el siguiente!" onPress={close} />
        </Animated.View>
      </View>

      {/* Destello del cambio de rango. */}
      {newTier ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: '#FFFFFF', opacity: Animated.multiply(v.flash, 0.85) },
          ]}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 50, elevation: 50 },
  abs: { position: 'absolute' },
  ring: { width: BADGE, height: BADGE, borderRadius: BADGE / 2, borderWidth: 3 },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: { fontFamily: fonts.title, fontSize: 13, letterSpacing: 3, marginBottom: -6 },
  // Los dos números van uno encima de otro, centrados en la insignia.
  numberBox: { width: BADGE, height: 84 },
  number: {
    ...displayFont(76),
    includeFontPadding: false,
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    textAlign: 'center',
  },
  piece: { position: 'absolute', left: -4, top: -4, borderRadius: 2 },
  bottom: { position: 'absolute', left: 24, right: 24, gap: 18, alignItems: 'stretch' },
  title: { ...titleFont(26), textAlign: 'center' },
  rankLine: { ...titleFont(20), textAlign: 'center', marginTop: 6 },
  subtitle: { ...proseFont(16, 22), textAlign: 'center', marginTop: 4 },
  // Premios en dos columnas para que quepan todos (también con cambio de rango).
  rewards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reward: {
    flexBasis: '45%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: shape.card - 8,
    borderWidth: 1,
  },
  kicker: { fontFamily: fonts.title, fontSize: 12, letterSpacing: 2, textAlign: 'center' },
  rewardTexts: { flex: 1, gap: 2 },
  rewardKind: { fontFamily: fonts.title, fontSize: 12 },
  rewardText: { fontFamily: fonts.title, fontSize: 14, flexShrink: 1 },
});

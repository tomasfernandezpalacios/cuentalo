import { router } from 'expo-router';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { chipColors, fonts, shape, useThemeColors } from '@/lib/theme';

import { COIN_FLIGHT_MS, registerCoinTarget, useCoinArrivals } from '../coinBurst';
import { useProgress } from '../demoStore';
import { levelInfo } from '../model';
import { rankOf } from '../ranks';
import { RankEmblem } from './RankEmblem';
import { CoinIcon } from './Bits';
import { Tappable } from '@/components/Tappable';

/** Lo que tarda en contar hacia arriba las monedas que llegan. */
const COUNT_MS = 700;

/**
 * Número que sube poco a poco hasta `target` cuando aumenta (empieza cuando llega la primera
 * moneda volando) y baja al momento cuando disminuye (al comprar).
 */
function useCountUp(target: number) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const start = shownRef.current;
    if (target <= start) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    let raf = 0;
    let begin = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - begin) / COUNT_MS);
      const value = Math.round(start + (target - start) * t);
      shownRef.current = value;
      setShown(value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    // Espera a que llegue la primera moneda (vuela casi todo `COIN_FLIGHT_MS`).
    const timer = setTimeout(() => {
      begin = Date.now();
      raf = requestAnimationFrame(tick);
    }, COIN_FLIGHT_MS * 0.9);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      // Si llega otro cambio a medias, sigue desde donde iba.
    };
  }, [target]);

  return shown;
}

/**
 * Tus monedas en la cabecera de «Progreso»; al tocarlas se abre la tienda. Las monedas ganadas
 * vuelan hasta aquí (`CoinBurstLayer`): con cada una el botón da un pequeño salto y el número sube
 * poco a poco. Con `still`, solo se enseñan (en la propia tienda).
 */
export function CoinsButton({ still = false }: { still?: boolean }) {
  const colors = useThemeColors();
  const { coins } = useProgress();
  const shown = useCountUp(coins);
  const chip = chipColors(colors, false);
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [bump] = useState(() => new Animated.Value(1));

  // Dónde está, para que las monedas sepan a dónde volar.
  useEffect(() => {
    if (still) return;
    registerCoinTarget(
      () =>
        new Promise((resolve) => {
          if (!ref.current) return resolve(null);
          ref.current.measureInWindow((x, y, width, height) =>
            resolve(width > 0 ? { x: x + 18, y: y + height / 2 } : null),
          );
        }),
    );
    return () => registerCoinTarget(null);
  }, [still]);

  const onArrive = useCallback(() => {
    bump.setValue(1.18);
    Animated.timing(bump, {
      toValue: 1,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [bump]);
  useCoinArrivals(onArrive);

  const content = (
    <>
      <CoinIcon size={20} />
      <Text style={[styles.text, { color: colors.text }]}>{shown}</Text>
    </>
  );

  if (still) {
    return (
      <View
        accessibilityLabel={`${coins} monedas`}
        style={[styles.chip, styles.edge, { backgroundColor: chip.backgroundColor }]}
      >
        {content}
      </View>
    );
  }
  return (
    <Animated.View ref={ref} collapsable={false} style={{ transform: [{ scale: bump }] }}>
      <Tappable
        onPress={() => router.push('/progreso/tienda')}
        accessibilityRole="button"
        accessibilityLabel={`${coins} monedas. Abrir la tienda`}
        hitSlop={8}
        style={({ pressed }) => [
          styles.chip,
          { backgroundColor: chip.backgroundColor, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        {content}
      </Tappable>
    </Animated.View>
  );
}

/** Las monedas en la cabecera de «Progreso» (la XP se ve en el camino de niveles). */
export function ProgressHeaderStats() {
  return (
    <View style={[styles.row, styles.edge]} collapsable={false}>
      <LevelChip />
      <CoinsButton />
    </View>
  );
}

/**
 * Tu nivel en la cabecera: el emblema de tu rango, el número y una barrita con lo que llevas del
 * nivel. Al tocarlo se abre el camino de rangos.
 */
export function LevelChip() {
  const colors = useThemeColors();
  const { xp } = useProgress();
  const info = levelInfo(xp);
  const rank = rankOf(info.level);
  return (
    <Tappable
      onPress={() => router.push('/progreso/camino')}
      accessibilityRole="button"
      accessibilityLabel={`Nivel ${info.level}, ${rank.name}. Abrir el camino`}
      hitSlop={8}
      style={({ pressed }) => [
        styles.chip,
        styles.levelChip,
        // Sin píldora detrás (petición del usuario): solo el emblema, el número y la barra.
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {/* El emblema, grande y sobresaliendo un poco de la píldora para que destaque. */}
      <View style={styles.levelEmblem}>
        <RankEmblem tier={rank.tier} size={58} />
      </View>
      <View style={styles.levelTexts}>
        <Text style={[styles.levelNumber, { color: colors.text }]}>{`Nv ${info.level}`}</Text>
        <View style={[styles.levelTrack, { backgroundColor: colors.elevated }]}>
          <View
            style={[
              styles.levelFill,
              { width: `${Math.round(info.fraction * 100)}%`, backgroundColor: rank.tier.color },
            ]}
          />
        </View>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  edge: { marginRight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  levelChip: { paddingLeft: 2, paddingRight: 0, paddingVertical: 4, gap: 0 },
  // El dibujo deja aire alrededor del emblema: con márgenes negativos queda grande y pegado a la
  // barra sin ensanchar la píldora.
  levelEmblem: { marginVertical: -16, marginLeft: -12, marginRight: -6 },
  levelTexts: { gap: 3 },
  levelNumber: { fontFamily: fonts.title, fontSize: 13 },
  levelTrack: { width: 84, height: 7, borderRadius: 4, overflow: 'hidden' },
  levelFill: { height: 7, borderRadius: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: shape.chip,
  },
  text: { fontFamily: fonts.title, fontSize: 15 },
});

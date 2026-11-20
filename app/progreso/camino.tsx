import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { ProgressBar } from '@/features/progreso/components/Bits';
import { useProgress } from '@/features/progreso/demoStore';
import { levelCoins, levelInfo, xpToReach } from '@/features/progreso/model';
import { RankEmblem } from '@/features/progreso/components/RankEmblem';
import { CHAPTERS_AHEAD, rankOf, tierLevels, TIERS } from '@/features/progreso/ranks';
import { giftsAt, KIND_LABEL, unlocksAt } from '@/features/progreso/shop';
import { withAlpha } from '@/lib/color';
import { displayFont, fonts, proseFont, shape, titleFont, useThemeColors } from '@/lib/theme';

/** Cuánto se separan los niveles del centro al hacer la curva. */
const SWING = 64;

/** Recompensas de un nivel en texto, una por línea. */
function rewardLines(level: number): string[] {
  return [
    `+${levelCoins(level)} monedas`,
    ...giftsAt(level).map((item) => `Regalo: ${KIND_LABEL[item.kind]} «${item.name}»`),
    ...unlocksAt(level).map((item) => `En la tienda: ${item.name}`),
  ];
}

/** Aviso al tocar un nivel: su rango, lo que falta para llegar y lo que da. */
function showLevel(level: number, xp: number, current: number) {
  const rank = rankOf(level);
  const head =
    level < current
      ? 'Ya lo conseguiste.'
      : level === current
        ? 'Estás aquí.'
        : `Te faltan ${xpToReach(xp, level)} XP para llegar.`;
  const intro = rank.firstOfTier
    ? `${head}\n\nEmpieza el capítulo «${rank.tier.name}»: ${rank.tier.motto}`
    : head;
  const rewards = level === 1 ? [] : rewardLines(level);
  appAlert(
    `${rank.name} · Nivel ${level}`,
    rewards.length > 0
      ? `${intro}\n\n${level <= current ? 'Te dio:' : 'Conseguirás:'}\n${rewards.map((r) => `· ${r}`).join('\n')}`
      : intro,
  );
}

/** Cabecera épica: tu rango actual, su emblema con un halo que late y lo que falta. */
function Hero({ xp }: { xp: number }) {
  const colors = useThemeColors();
  const info = levelInfo(xp);
  const rank = rankOf(info.level);
  const next = info.max ? null : rankOf(info.level + 1);
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View
      style={[
        styles.hero,
        {
          backgroundColor: withAlpha(rank.tier.color, 0.12),
          borderColor: withAlpha(rank.tier.color, 0.6),
        },
      ]}
    >
      <View style={styles.heroEmblem}>
        <Animated.View
          style={[
            styles.halo,
            {
              borderColor: rank.tier.color,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) },
              ],
            },
          ]}
        />
        <RankEmblem tier={rank.tier} size={120} />
      </View>
      <Text style={[styles.kicker, { color: rank.tier.color }]}>
        {`CAPÍTULO ${rank.tier.chapter} · RANGO ACTUAL`}
      </Text>
      <Text style={[styles.heroName, { color: colors.text }]}>{rank.name}</Text>
      <Text style={[styles.motto, { color: colors.textMuted }]}>{rank.tier.motto}</Text>
      <View style={styles.heroBar}>
        <View style={styles.heroBarHead}>
          <Text style={[styles.detail, { color: colors.text }]}>{`Nivel ${info.level}`}</Text>
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            {info.max ? 'Nivel máximo' : `${info.into} / ${info.cost} XP`}
          </Text>
        </View>
        <ProgressBar fraction={info.fraction} height={10} color={rank.tier.color} />
        {next ? (
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            {`Te faltan ${info.cost - info.into} XP para ser ${next.name}`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * El camino de tu vida (petición del usuario: que transmita avance en la vida, no en un juego):
 * arriba tu rango actual a lo grande; debajo, los 10 capítulos (de Semilla a Leyenda), cada uno
 * con su emblema, su frase y sus 5 rangos como bolas que van de lado a lado. Tocar un nivel dice
 * cuánto falta y qué da. Se abre desde el nivel de la cabecera y baja solo hasta tu capítulo.
 */
export default function PathScreen() {
  const colors = useThemeColors();
  const { xp } = useProgress();
  const info = levelInfo(xp);
  const current = rankOf(info.level);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrolled = useRef(false);
  const lastVisible = current.tier.chapter + CHAPTERS_AHEAD;
  const visibleTiers = TIERS.filter((tier) => tier.chapter <= lastVisible);
  const moreAhead = TIERS.length > lastVisible;

  return (
    <ScrollView
      ref={scroll}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Hero xp={xp} />

      {/* Solo los capítulos alcanzados y dos más: el final no se enseña. */}
      {visibleTiers.map((tier) => {
        const levels = tierLevels(tier);
        const first = levels[0] ?? 1;
        const done = info.level > (levels[levels.length - 1] ?? 0);
        const isCurrent = tier.chapter === current.tier.chapter;
        const locked = info.level < first;
        return (
          <View
            key={tier.chapter}
            style={styles.chapter}
            onLayout={(e) => {
              // Al abrir, baja hasta tu capítulo (una sola vez).
              if (!isCurrent || scrolled.current) return;
              scrolled.current = true;
              scroll.current?.scrollTo({
                y: Math.max(0, e.nativeEvent.layout.y - 24),
                animated: true,
              });
            }}
          >
            <View
              style={[
                styles.banner,
                {
                  backgroundColor: isCurrent ? withAlpha(tier.color, 0.14) : colors.surface,
                  borderColor: isCurrent ? tier.color : colors.border,
                  opacity: locked ? 0.7 : 1,
                },
              ]}
            >
              <RankEmblem tier={tier} size={60} />
              <View style={styles.bannerTexts}>
                <Text
                  style={[styles.chapterKicker, { color: locked ? colors.textMuted : tier.color }]}
                >
                  {`CAPÍTULO ${tier.chapter}${done ? ' · SUPERADO' : isCurrent ? ' · AHORA' : ''}`}
                </Text>
                <Text style={[styles.chapterName, { color: colors.text }]}>{tier.name}</Text>
                <Text style={[styles.chapterMotto, { color: colors.textMuted }]}>
                  {locked ? `Desde el nivel ${first}. ${tier.motto}` : tier.motto}
                </Text>
              </View>
              {done ? <Ionicons name="checkmark-circle" size={22} color={tier.color} /> : null}
            </View>

            <View style={styles.nodes}>
              {levels.map((level, i) => {
                const past = level < info.level;
                const here = level === info.level;
                const gift = giftsAt(level).length > 0;
                const size = here ? 70 : 56;
                const rank = rankOf(level);
                return (
                  <View
                    key={level}
                    style={[
                      styles.step,
                      { transform: [{ translateX: Math.sin((i + tier.chapter) * 1.1) * SWING }] },
                    ]}
                  >
                    <Pressable
                      onPress={() => showLevel(level, xp, info.level)}
                      accessibilityRole="button"
                      accessibilityLabel={`${rank.name}, nivel ${level}${here ? ', estás aquí' : past ? ', conseguido' : ''}`}
                      style={({ pressed }) => [
                        styles.node,
                        {
                          width: size,
                          height: size,
                          borderRadius: size / 2,
                          backgroundColor: past
                            ? tier.color
                            : here
                              ? withAlpha(tier.color, 0.22)
                              : colors.elevated,
                          borderColor: here ? tier.color : 'transparent',
                          borderBottomWidth: here ? 3 : 5,
                          borderBottomColor: here ? tier.color : colors.border,
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                    >
                      {past ? (
                        <Ionicons name="checkmark" size={24} color={tier.ink} />
                      ) : (
                        <Text
                          style={[
                            styles.nodeNumber,
                            { color: here ? colors.text : colors.textMuted },
                          ]}
                        >
                          {level}
                        </Text>
                      )}
                      {gift ? (
                        <View
                          style={[
                            styles.gift,
                            { backgroundColor: colors.background, borderColor: colors.primary },
                          ]}
                        >
                          <Ionicons name="gift" size={12} color={colors.primary} />
                        </View>
                      ) : null}
                    </Pressable>
                    <Text
                      style={[
                        styles.nodeRank,
                        { color: here ? tier.color : past ? colors.textMuted : colors.textMuted },
                      ]}
                    >
                      {here ? `${rank.name} · estás aquí` : rank.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

      {moreAhead ? (
        <View style={[styles.mystery, { borderColor: colors.border }]}>
          <RankEmblem tier={current.tier} size={72} locked />
          <Text style={[styles.mysteryTitle, { color: colors.text }]}>Más allá…</Text>
          <Text style={[styles.end, { color: colors.textMuted }]}>
            Hay rangos que aún no puedes ver. Cada día que registras te acerca un poco más.
          </Text>
        </View>
      ) : (
        <Text style={[styles.end, { color: colors.textMuted }]}>
          Has llegado más lejos que nadie. Sigue escribiendo tu historia.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 22, paddingBottom: 48 },
  hero: {
    alignItems: 'center',
    gap: 8,
    padding: 22,
    borderRadius: shape.card,
    borderWidth: 1,
  },
  heroEmblem: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 3 },
  kicker: { fontFamily: fonts.title, fontSize: 11, letterSpacing: 1.6, textAlign: 'center' },
  heroName: { ...titleFont(30), textAlign: 'center' },
  motto: { ...proseFont(16, 22), textAlign: 'center' },
  heroBar: { alignSelf: 'stretch', gap: 6, marginTop: 8 },
  heroBarHead: { flexDirection: 'row', justifyContent: 'space-between' },
  detail: { fontFamily: fonts.detail, fontSize: 13 },
  chapter: { gap: 14 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: shape.card - 4,
    borderWidth: 1,
  },
  bannerTexts: { flex: 1, gap: 2 },
  chapterKicker: { fontFamily: fonts.title, fontSize: 11, letterSpacing: 1.4 },
  chapterName: { ...titleFont(20) },
  chapterMotto: { ...proseFont(14, 19) },
  nodes: { alignItems: 'center', gap: 14, paddingVertical: 6 },
  step: { alignItems: 'center', gap: 4 },
  node: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  nodeNumber: { ...displayFont(22), includeFontPadding: false },
  nodeRank: { fontFamily: fonts.detail, fontSize: 12 },
  gift: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mystery: {
    alignItems: 'center',
    gap: 8,
    padding: 22,
    borderRadius: shape.card,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  mysteryTitle: { ...titleFont(22) },
  end: { ...proseFont(15, 21), textAlign: 'center', marginTop: 8 },
});

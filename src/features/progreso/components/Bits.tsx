import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { fonts, useThemeColors } from '@/lib/theme';

/** Barra de progreso fina (0–1) del color de la app sobre un carril apagado. */
export function ProgressBar({
  fraction,
  height = 8,
  color,
}: {
  fraction: number;
  height?: number;
  color?: string;
}) {
  const colors = useThemeColors();
  const width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` as const;
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: colors.elevated }]}
    >
      <View
        style={{
          width,
          height,
          borderRadius: height / 2,
          backgroundColor: color ?? colors.primary,
        }}
      />
    </View>
  );
}

/** Moneda de Kuentio: un círculo dorado con un borde y una «K» de relieve. */
export function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="-1 -1 2 2">
      <Circle r={0.96} fill="#E3B850" />
      <Circle r={0.72} fill="none" stroke="#9C7A22" strokeWidth={0.1} />
      <Path
        d="M -0.24 -0.42 L -0.24 0.42 M -0.24 0.04 L 0.26 -0.42 M -0.1 -0.08 L 0.28 0.42"
        stroke="#755714"
        strokeWidth={0.17}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Premio de una misión o un nivel: «+20 XP · +5 🪙». */
export function Reward({ xp, coins, muted }: { xp: number; coins: number; muted?: boolean }) {
  const colors = useThemeColors();
  const color = muted ? colors.textMuted : colors.primary;
  return (
    <View style={styles.reward}>
      <Text style={[styles.rewardText, { color }]}>{`+${xp} XP`}</Text>
      {coins > 0 ? (
        <>
          <Text style={[styles.rewardText, { color: colors.textMuted }]}>·</Text>
          <Text style={[styles.rewardText, { color }]}>{`+${coins}`}</Text>
          <CoinIcon size={13} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rewardText: { fontFamily: fonts.title, fontSize: 12 },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Polygon,
  Stop,
} from 'react-native-svg';

import { fonts } from '@/lib/theme';

import { emblemStage, type Tier } from '../ranks';

type IconName = ComponentProps<typeof Ionicons>['name'];

const RIM = '#F3E2A6';
const LAUREL = '#D9B45A';

/** Mezcla un color #RRGGBB con blanco (`amount` 0–1). */
function lighten(hex: string, amount: number): string {
  const mix = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(c + (255 - c) * amount)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${mix(1)}${mix(3)}${mix(5)}`;
}

/** Polígono regular o estrella (radios alternos) centrado en 0, con la primera punta arriba. */
function polygon(points: number, outer: number, inner = outer): string {
  const total = inner === outer ? points : points * 2;
  return Array.from({ length: total }, (_, i) => {
    const r = i % 2 === 0 || inner === outer ? outer : inner;
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / total;
    return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
  }).join(' ');
}

const SHIELD = 'M 0 -34 L 28 -25 L 27 6 Q 22 25 0 37 Q -22 25 -27 6 L -28 -25 Z';

/** Rayos de fondo (desde la fase 4). */
function Sunburst({ color }: { color: string }) {
  return (
    <G opacity={0.4}>
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const b = a + Math.PI / 16;
        return (
          <Path
            key={i}
            d={`M ${Math.cos(a) * 26} ${Math.sin(a) * 26} L ${Math.cos(a + Math.PI / 32) * 49} ${Math.sin(a + Math.PI / 32) * 49} L ${Math.cos(b) * 26} ${Math.sin(b) * 26} Z`}
            fill={color}
          />
        );
      })}
    </G>
  );
}

/** Ramas de laurel a los lados (desde la fase 3). */
function Laurels() {
  return (
    <>
      {[-1, 1].map((side) => (
        <G key={side}>
          {Array.from({ length: 6 }, (_, i) => {
            const t = 0.35 + i * 0.22;
            const x = side * 38 * Math.cos(t);
            const y = 38 * Math.sin(t) - 6;
            const angle = side * ((t * 180) / Math.PI + 90);
            return (
              <Ellipse
                key={i}
                cx={x}
                cy={y}
                rx={6}
                ry={2.6}
                fill={LAUREL}
                transform={`rotate(${angle} ${x} ${y})`}
              />
            );
          })}
        </G>
      ))}
    </>
  );
}

/** Alas a los lados (fase 5). */
function Wings({ color }: { color: string }) {
  return (
    <>
      {[-1, 1].map((side) => (
        <G key={side} transform={`scale(${side} 1)`}>
          <Path
            d="M 22 -8 Q 44 -26 50 -16 Q 42 -12 46 -6 Q 36 -4 40 2 Q 30 2 24 8 Z"
            fill={lighten(color, 0.55)}
          />
          <Path d="M 22 -4 Q 38 -16 44 -10 Q 34 -4 26 4 Z" fill={lighten(color, 0.8)} />
        </G>
      ))}
    </>
  );
}

/** Corona encima (fase 5). */
function Crown() {
  return (
    <Path
      d="M -12 -36 L -14 -47 L -6 -41 L 0 -49 L 6 -41 L 14 -47 L 12 -36 Z"
      fill={RIM}
      stroke="#B88A1E"
      strokeWidth={1}
      strokeLinejoin="round"
    />
  );
}

/**
 * Emblema de un capítulo (petición del usuario: de más simple a más épico y más «pro»). Cada 4
 * capítulos se complica: 1) círculo liso; 2) hexágono con degradado y aro; 3) escudo con borde
 * dorado y laurel; 4) además rayos detrás y cinta; 5) estrella con alas y corona. En el centro, el
 * icono del capítulo. Con `locked`, solo una silueta con «?» (capítulos aún por descubrir).
 */
export function RankEmblem({
  tier,
  size,
  locked = false,
}: {
  tier: Tier;
  size: number;
  locked?: boolean;
}) {
  const id = `e${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const stage = locked ? 1 : emblemStage(tier.chapter);
  const color = locked ? '#3A3631' : tier.color;
  const light = lighten(color, 0.45);
  const fill = stage === 1 ? color : `url(#${id})`;
  const rim = stage >= 3 ? RIM : stage === 2 ? lighten(color, 0.6) : 'none';

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="-50 -50 100 100">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={light} />
            <Stop offset="1" stopColor={color} />
          </LinearGradient>
        </Defs>
        {stage >= 4 ? <Sunburst color={color} /> : null}
        {stage >= 5 ? <Wings color={color} /> : null}
        {stage >= 3 ? <Laurels /> : null}
        {stage >= 4 ? (
          <Path
            d="M -26 24 L 26 24 L 22 32 L 26 40 L -26 40 L -22 32 Z"
            fill={lighten(color, 0.2)}
            stroke={RIM}
            strokeWidth={1.2}
          />
        ) : null}
        {stage === 1 ? (
          <Circle r={locked ? 32 : 34} fill={fill} />
        ) : stage === 2 ? (
          <Polygon
            points={polygon(6, 36)}
            fill={fill}
            stroke={rim}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        ) : stage <= 4 ? (
          <>
            <Path d={SHIELD} fill={fill} stroke={rim} strokeWidth={3} strokeLinejoin="round" />
            {stage === 4 ? (
              <Path
                d={SHIELD}
                fill="none"
                stroke={RIM}
                strokeWidth={1}
                transform="scale(0.82)"
                opacity={0.8}
              />
            ) : null}
          </>
        ) : (
          <>
            <Polygon
              points={polygon(8, 38, 31)}
              fill={fill}
              stroke={rim}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            <Polygon
              points={polygon(8, 30, 25)}
              fill="none"
              stroke={RIM}
              strokeWidth={1}
              opacity={0.8}
            />
          </>
        )}
        {stage >= 5 ? <Crown /> : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {locked ? (
          <Text style={[styles.mystery, { fontSize: size * 0.32 }]}>?</Text>
        ) : (
          <Ionicons
            name={tier.icon as IconName}
            size={size * (stage >= 5 ? 0.36 : 0.44)}
            color={tier.ink}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  mystery: { fontFamily: fonts.title, color: '#8A8378' },
});

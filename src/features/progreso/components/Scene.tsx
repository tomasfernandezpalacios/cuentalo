import { useId } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { useThemeColors } from '@/lib/theme';

import type { BackgroundId } from '../shop';

// Fondos donde se ve la mascota. Se dibujan en un lienzo de 100 × 60 que se estira al tamaño de
// la tarjeta (`preserveAspectRatio="none"`, así los cielos y el suelo llenan siempre). La mascota
// se apoya en el suelo, que ocupa la franja de abajo (de y = 46 a 60). Colores apagados, como el
// resto de la app.

const W = 100;
const H = 60;

/** Estrellas fijas (x, y, radio) para los cielos de noche. */
const STARS: [number, number, number][] = [
  [8, 6, 0.5],
  [17, 14, 0.35],
  [26, 5, 0.4],
  [36, 11, 0.3],
  [47, 4, 0.45],
  [58, 13, 0.35],
  [66, 7, 0.5],
  [79, 15, 0.3],
  [88, 5, 0.4],
  [94, 18, 0.35],
  [12, 24, 0.3],
  [41, 22, 0.3],
  [71, 26, 0.35],
  [53, 30, 0.25],
  [23, 33, 0.25],
  [85, 31, 0.3],
];

function Sky({ id, top, bottom }: { id: string; top: string; bottom: string }) {
  return (
    <>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={W} height={H} fill={`url(#${id})`} />
    </>
  );
}

function Stars({ count = STARS.length, color = '#F0EDE0' }: { count?: number; color?: string }) {
  return (
    <>
      {STARS.slice(0, count).map(([x, y, r]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={color} opacity={0.85} />
      ))}
    </>
  );
}

function Drawing({ id, sky }: { id: BackgroundId; sky: string }) {
  const colors = useThemeColors();
  switch (id) {
    case 'papel':
      return (
        <>
          <Rect x={0} y={0} width={W} height={H} fill={colors.surface} />
          <Rect x={0} y={46} width={W} height={14} fill={colors.elevated} />
        </>
      );
    case 'noche':
      return (
        <>
          <Sky id={sky} top="#0C1228" bottom="#27325E" />
          <Stars />
          <Circle cx={82} cy={12} r={5} fill="#F0EDE0" />
          <Circle cx={84.5} cy={10.5} r={4.4} fill="#141C3D" />
          <Path d="M 0 48 Q 25 42 50 47 T 100 45 L 100 60 L 0 60 Z" fill="#141A33" />
        </>
      );
    case 'atardecer':
      return (
        <>
          <Sky id={sky} top="#5A2E3E" bottom="#E79B5E" />
          <Circle cx={50} cy={46} r={12} fill="#F6D08A" opacity={0.95} />
          <Path d="M 0 44 Q 30 38 55 44 T 100 41 L 100 60 L 0 60 Z" fill="#7A3B3F" />
          <Rect x={0} y={47} width={W} height={13} fill="#3B2230" />
        </>
      );
    case 'bosque':
      return (
        <>
          <Sky id={sky} top="#BFD8C2" bottom="#E7EFDF" />
          <Path d="M 0 40 Q 20 30 45 38 T 100 34 L 100 60 L 0 60 Z" fill="#7FA486" />
          {[6, 18, 30, 70, 82, 94].map((x, i) => (
            <Path
              key={x}
              d={`M ${x} ${30 + (i % 2) * 3} L ${x - 6} 48 L ${x + 6} 48 Z`}
              fill={i % 2 === 0 ? '#2F5D43' : '#3B6E50'}
            />
          ))}
          <Rect x={0} y={46} width={W} height={14} fill="#4C7A57" />
        </>
      );
    case 'mar':
      return (
        <>
          <Sky id={sky} top="#A9CFE6" bottom="#E8F2F6" />
          <Circle cx={18} cy={12} r={5} fill="#F7E6B0" />
          <Rect x={0} y={34} width={W} height={14} fill="#3E7CA8" />
          {[37, 41, 45].map((y) => (
            <Path
              key={y}
              d={`M 0 ${y} Q 6 ${y - 1.2} 12 ${y} T 24 ${y} T 36 ${y} T 48 ${y} T 60 ${y} T 72 ${y} T 84 ${y} T 96 ${y} T 108 ${y}`}
              stroke="#CFE4F1"
              strokeWidth={0.4}
              fill="none"
              opacity={0.7}
            />
          ))}
          <Path d="M 0 47 Q 50 43 100 47 L 100 60 L 0 60 Z" fill="#E6D2A3" />
        </>
      );
    case 'ciudad':
      return (
        <>
          <Sky id={sky} top="#22243A" bottom="#5C4D7D" />
          <Stars count={8} />
          {[
            [0, 26, 10],
            [11, 18, 9],
            [21, 30, 8],
            [30, 14, 11],
            [62, 22, 9],
            [72, 12, 10],
            [83, 28, 8],
            [92, 20, 8],
          ].map(([x, top, w]) => (
            <Rect key={x} x={x} y={top} width={w} height={H - (top ?? 0)} fill="#171828" />
          ))}
          {[
            [2, 30],
            [5, 36],
            [13, 22],
            [16, 30],
            [33, 18],
            [37, 26],
            [33, 34],
            [65, 28],
            [75, 16],
            [78, 24],
            [75, 34],
            [94, 26],
          ].map(([x, y]) => (
            <Rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1.6}
              height={2}
              fill="#E9C46A"
              opacity={0.8}
            />
          ))}
          <Rect x={0} y={46} width={W} height={14} fill="#2A2B3D" />
        </>
      );
    case 'espacio':
      return (
        <>
          <Sky id={sky} top="#04050C" bottom="#161B3A" />
          <Stars />
          <Circle cx={80} cy={16} r={7} fill="#B9774E" />
          <Ellipse
            cx={80}
            cy={16}
            rx={12}
            ry={2.6}
            stroke="#E3C08D"
            strokeWidth={0.8}
            fill="none"
            transform="rotate(-15 80 16)"
          />
          <Path d="M 0 50 Q 50 41 100 50 L 100 60 L 0 60 Z" fill="#8E8C99" />
          <Circle cx={22} cy={53} r={2} fill="#77768A" />
          <Circle cx={70} cy={55} r={1.4} fill="#77768A" />
        </>
      );
    case 'aurora':
      return (
        <>
          <Sky id={sky} top="#051019" bottom="#123142" />
          <Stars count={10} />
          <Path
            d="M -5 22 Q 20 6 45 18 T 105 12 L 105 20 Q 75 26 45 26 T -5 30 Z"
            fill="#5FD3A4"
            opacity={0.35}
          />
          <Path
            d="M -5 30 Q 25 16 55 26 T 105 22 L 105 27 Q 70 32 50 31 T -5 35 Z"
            fill="#4FB7C9"
            opacity={0.3}
          />
          <Path d="M 0 46 L 20 36 L 34 46 Z" fill="#2B4A5A" />
          <Path d="M 60 46 L 80 32 L 100 46 Z" fill="#244150" />
          <Rect x={0} y={46} width={W} height={14} fill="#DDE8EE" />
        </>
      );
    case 'lluvia':
      return (
        <>
          <Sky id={sky} top="#3F4955" bottom="#7F8B96" />
          <Ellipse cx={22} cy={8} rx={20} ry={6} fill="#5A6470" />
          <Ellipse cx={70} cy={6} rx={26} ry={7} fill="#535D69" />
          {scatter(34, 5, 44).map(([x, y]) => (
            <Line
              key={`${x}-${y}`}
              x1={x}
              y1={y}
              x2={x - 1.2}
              y2={y + 3.2}
              stroke="#C9D6E2"
              strokeWidth={0.3}
              opacity={0.7}
            />
          ))}
          <Rect x={0} y={46} width={W} height={14} fill="#343B42" />
          <Ellipse cx={70} cy={53} rx={14} ry={1.6} fill="#55606B" />
        </>
      );
    case 'nieve':
      return (
        <>
          <Sky id={sky} top="#9FB6C8" bottom="#E4ECF2" />
          {[12, 84].map((x) => (
            <G key={x}>
              <Path d={`M ${x} 22 L ${x - 7} 46 L ${x + 7} 46 Z`} fill="#2F5446" />
              <Path d={`M ${x} 22 L ${x - 3} 30 L ${x + 3} 30 Z`} fill="#FFFFFF" />
            </G>
          ))}
          {scatter(40, 9, 46).map(([x, y]) => (
            <Circle key={`${x}-${y}`} cx={x} cy={y} r={0.55} fill="#FFFFFF" opacity={0.9} />
          ))}
          <Path d="M 0 46 Q 50 41 100 46 L 100 60 L 0 60 Z" fill="#F4F7FA" />
        </>
      );
    case 'desierto':
      return (
        <>
          <Sky id={sky} top="#F0B979" bottom="#F9E7C4" />
          <Circle cx={78} cy={13} r={6} fill="#FFF1C9" />
          <Path d="M 0 40 Q 30 30 60 40 T 100 36 L 100 60 L 0 60 Z" fill="#D9A066" />
          <Path d="M 0 48 Q 40 42 100 48 L 100 60 L 0 60 Z" fill="#C98B4E" />
          <Path
            d="M 16 48 L 16 34 Q 16 31 18 31 Q 20 31 20 34 L 20 48 Z M 16 40 L 13 40 L 13 36"
            fill="#4F7A47"
            stroke="#4F7A47"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </>
      );
    case 'montana':
      return (
        <>
          <Sky id={sky} top="#8DB8DA" bottom="#DCEAF4" />
          <Path d="M -5 46 L 28 12 L 60 46 Z" fill="#6E7F96" />
          <Path d="M 28 12 L 21 19 L 25 21 L 29 18 L 33 21 L 35 17 Z" fill="#FFFFFF" />
          <Path d="M 40 46 L 72 18 L 105 46 Z" fill="#53647C" />
          <Path d="M 72 18 L 66 23 L 70 25 L 74 22 L 78 24 Z" fill="#FFFFFF" />
          <Rect x={0} y={46} width={W} height={14} fill="#6C8F5E" />
        </>
      );
    case 'biblioteca':
      return (
        <>
          <Rect x={0} y={0} width={W} height={H} fill="#3B2A20" />
          {[6, 19, 32].map((y) => (
            <G key={y}>
              {scatter(14, y, 0).map(([x], i) => (
                <Rect
                  key={i}
                  x={(i * 7.2) % 100}
                  y={y + 1 + (i % 3)}
                  width={4 + (x % 2)}
                  height={10 - (i % 3)}
                  fill={['#8E3B2E', '#2E5A6B', '#C9A24B', '#4F6B3A', '#6B4A7A'][i % 5]}
                />
              ))}
              <Rect x={0} y={y + 11} width={W} height={1.6} fill="#5A3E2B" />
            </G>
          ))}
          <Rect x={0} y={46} width={W} height={14} fill="#2A1E17" />
        </>
      );
    case 'cerezos':
      return (
        <>
          <Sky id={sky} top="#F3D3DC" bottom="#FBEFF2" />
          {[16, 84].map((x) => (
            <G key={x}>
              <Rect x={x - 1.2} y={26} width={2.4} height={20} fill="#6B4A3A" />
              <Circle cx={x} cy={22} r={10} fill="#F0A8BC" />
              <Circle cx={x - 6} cy={26} r={6} fill="#EDB6C6" />
              <Circle cx={x + 6} cy={25} r={6} fill="#E996AE" />
            </G>
          ))}
          {scatter(16, 3, 44).map(([x, y]) => (
            <Ellipse key={`${x}-${y}`} cx={x} cy={y} rx={0.8} ry={0.5} fill="#F2A7BB" />
          ))}
          <Rect x={0} y={46} width={W} height={14} fill="#C9D9A8" />
        </>
      );
    case 'girasoles':
      return (
        <>
          <Sky id={sky} top="#8CC6EC" bottom="#E2F3FB" />
          <Rect x={0} y={38} width={W} height={22} fill="#5E8F3C" />
          {[6, 20, 78, 92, 34, 64].map((x, i) => (
            <G key={x}>
              <Line
                x1={x}
                y1={34 + (i % 2) * 3}
                x2={x}
                y2={50}
                stroke="#3F6B2A"
                strokeWidth={0.8}
              />
              <Circle cx={x} cy={33 + (i % 2) * 3} r={3.2} fill="#F2C230" />
              <Circle cx={x} cy={33 + (i % 2) * 3} r={1.4} fill="#6B4423" />
            </G>
          ))}
          <Rect x={0} y={48} width={W} height={12} fill="#4E7A31" />
        </>
      );
    case 'otono':
      return (
        <>
          <Sky id={sky} top="#E4BE92" bottom="#F6E6CF" />
          {[
            [14, '#D2692F'],
            [86, '#E39B3A'],
          ].map(([x, color]) => (
            <G key={String(x)}>
              <Rect x={Number(x) - 1.2} y={28} width={2.4} height={18} fill="#5E3B26" />
              <Circle cx={Number(x)} cy={24} r={10} fill={String(color)} />
            </G>
          ))}
          {scatter(14, 21, 46).map(([x, y], i) => (
            <Ellipse
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              rx={1}
              ry={0.6}
              fill={i % 2 === 0 ? '#D2692F' : '#C9A24B'}
            />
          ))}
          <Rect x={0} y={46} width={W} height={14} fill="#9A5B33" />
        </>
      );
    case 'fondo-marino':
      return (
        <>
          <Sky id={sky} top="#0B3C57" bottom="#1F7FA3" />
          {scatter(12, 13, 44).map(([x, y]) => (
            <Circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={0.9}
              stroke="#BFE4F2"
              strokeWidth={0.25}
              fill="none"
              opacity={0.7}
            />
          ))}
          {[8, 14, 86, 93].map((x, i) => (
            <Path
              key={x}
              d={`M ${x} 48 Q ${x - 3} 40 ${x} ${34 - i} Q ${x + 3} 28 ${x} ${22 + i}`}
              stroke="#3E8E5A"
              strokeWidth={1.4}
              fill="none"
              strokeLinecap="round"
            />
          ))}
          <Path d="M 0 47 Q 50 43 100 47 L 100 60 L 0 60 Z" fill="#D9C18F" />
        </>
      );
    case 'nubes':
      return (
        <>
          <Sky id={sky} top="#6FAEE3" bottom="#CFE6F7" />
          {[
            [18, 12, 9],
            [70, 9, 11],
            [44, 22, 7],
          ].map(([x, y, r]) => (
            <G key={x}>
              <Circle cx={x} cy={y} r={r} fill="#FFFFFF" opacity={0.92} />
              <Circle
                cx={(x ?? 0) + (r ?? 0)}
                cy={(y ?? 0) + 2}
                r={(r ?? 0) * 0.75}
                fill="#FFFFFF"
                opacity={0.92}
              />
              <Circle
                cx={(x ?? 0) - (r ?? 0)}
                cy={(y ?? 0) + 2}
                r={(r ?? 0) * 0.7}
                fill="#FFFFFF"
                opacity={0.92}
              />
            </G>
          ))}
          <Path
            d="M 0 50 Q 8 44 16 49 Q 24 43 34 48 Q 44 42 54 48 Q 64 43 74 48 Q 84 42 92 48 Q 98 45 100 47 L 100 60 L 0 60 Z"
            fill="#FFFFFF"
          />
        </>
      );
    case 'escenario':
      return (
        <>
          <Rect x={0} y={0} width={W} height={H} fill="#120B16" />
          <Path d="M 30 0 L 38 0 L 62 48 L 38 48 Z" fill="#E9C46A" opacity={0.12} />
          <Path d="M 62 0 L 70 0 L 62 48 L 38 48 Z" fill="#E9C46A" opacity={0.1} />
          <Path d="M 0 0 L 14 0 Q 10 24 16 48 L 0 48 Z" fill="#7A1F2B" />
          <Path d="M 100 0 L 86 0 Q 90 24 84 48 L 100 48 Z" fill="#7A1F2B" />
          <Rect x={0} y={0} width={W} height={4} fill="#5E1520" />
          <Rect x={0} y={46} width={W} height={14} fill="#3A2316" />
          <Ellipse cx={50} cy={50} rx={18} ry={2.4} fill="#E9C46A" opacity={0.18} />
        </>
      );
    case 'habitacion':
      return (
        <>
          <Rect x={0} y={0} width={W} height={H} fill="#E6D8C2" />
          <Rect x={62} y={8} width={26} height={22} rx={1} fill="#1E2A4A" />
          <Circle cx={80} cy={15} r={3} fill="#F0EDE0" />
          <Rect x={74.6} y={8} width={0.8} height={22} fill="#C9B79A" />
          <Rect x={62} y={18.6} width={26} height={0.8} fill="#C9B79A" />
          <Rect x={10} y={30} width={10} height={16} rx={1.5} fill="#9C6B45" />
          <Circle cx={15} cy={27} r={6} fill="#4F7A47" />
          <Rect x={0} y={46} width={W} height={14} fill="#9C6B45" />
          <Ellipse cx={50} cy={53} rx={26} ry={3} fill="#B9473F" opacity={0.7} />
        </>
      );
  }
}

/** Puntos fijos «al azar» (x de 0 a 100, y de 0 a `maxY`) con una semilla, para lluvia, nieve… */
function scatter(count: number, seed: number, maxY: number): [number, number][] {
  let s = seed * 9973 + 17;
  const random = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, () => [
    Math.round(random() * 1000) / 10,
    Math.round(random() * maxY * 10) / 10,
  ]);
}

/** El fondo `id` estirado a `width` × `height`. */
export function Scene({ id, width, height }: { id: BackgroundId; width: number; height: number }) {
  // Cada fondo necesita un degradado con nombre propio (único por dibujo).
  const sky = `cielo${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Drawing id={id} sky={sky} />
    </Svg>
  );
}

/** Proporción del suelo: la mascota apoya los pies a esta altura (fracción desde arriba). */
export const GROUND = 52 / H;

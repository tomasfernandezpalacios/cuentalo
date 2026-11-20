import { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import { BONE, MOUTH } from '@/features/mascota/face';

import { itemById, type AccessoryId, type Slot } from './shop';

// Accesorios de la mascota dibujados con las mismas unidades que su cara: radio de la bola = 1,
// origen en su centro, «y» hacia abajo. `Mascot` los pinta encima de la bola, así se mueven con
// ella en cada gesto.

const INK = '#1A1714';
const WINE = '#9E2F3C';
const GREEN = '#3D6B4F';
const CROWN = '#F2C230';
const BLUE = '#2E5A88';
const RUST = '#C4503A';
const BROWN = '#8B5A2B';
const PINK = '#E58FA8';
const WHITE = '#FAF7F0';

/** Corazón centrado en (0, 0), de unos 1 × 1. */
const HEART = 'M 0 0.32 C -0.62 -0.08 -0.36 -0.74 0 -0.38 C 0.36 -0.74 0.62 -0.08 0 0.32 Z';

/** Elipse como trazo (para hacer agujeros con `fillRule="evenodd"`). */
function ellipsePath(cx: number, cy: number, rx: number, ry: number) {
  return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;
}

/** Puntos repartidos por un arco de elipse (collares y coronas de flores). */
function arc(
  count: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
) {
  return Array.from({ length: count }, (_, i) => {
    const t = from + ((to - from) * i) / (count - 1);
    return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
  });
}

function Accessory({ id }: { id: AccessoryId }) {
  switch (id) {
    case 'gorro':
      return (
        <G>
          <Path d="M -0.46 -0.86 L 0.46 -0.86 L 0.08 -1.85 Z" fill={WINE} />
          <Circle cx={-0.12} cy={-1.08} r={0.07} fill={CROWN} />
          <Circle cx={0.16} cy={-1.3} r={0.06} fill={CROWN} />
          <Circle cx={-0.02} cy={-1.52} r={0.05} fill={CROWN} />
          <Circle cx={0.08} cy={-1.88} r={0.14} fill={BONE} />
        </G>
      );
    case 'chistera':
      return (
        <G>
          <Rect x={-0.38} y={-1.75} width={0.76} height={0.9} rx={0.04} fill={INK} />
          <Rect x={-0.38} y={-1.04} width={0.76} height={0.14} fill={WINE} />
          <Ellipse cx={0} cy={-0.88} rx={0.66} ry={0.1} fill={INK} />
        </G>
      );
    case 'corona':
      return (
        <G>
          <Path
            d="M -0.5 -0.82 L -0.56 -1.36 L -0.27 -1.1 L 0 -1.46 L 0.27 -1.1 L 0.56 -1.36 L 0.5 -0.82 Z"
            fill={CROWN}
            stroke={MOUTH}
            strokeWidth={0.04}
            strokeLinejoin="round"
          />
          <Circle cx={0} cy={-0.98} r={0.07} fill={WINE} />
          <Circle cx={-0.3} cy={-0.94} r={0.05} fill={GREEN} />
          <Circle cx={0.3} cy={-0.94} r={0.05} fill={GREEN} />
        </G>
      );
    case 'auriculares':
      return (
        <G>
          <Path
            d="M -1.02 -0.12 A 1.06 1.06 0 0 1 1.02 -0.12"
            stroke={INK}
            strokeWidth={0.13}
            fill="none"
            strokeLinecap="round"
          />
          <Rect x={-1.18} y={-0.42} width={0.3} height={0.58} rx={0.13} fill={INK} />
          <Rect x={0.88} y={-0.42} width={0.3} height={0.58} rx={0.13} fill={INK} />
          <Rect x={-1.12} y={-0.32} width={0.1} height={0.38} rx={0.05} fill={WINE} />
          <Rect x={1.02} y={-0.32} width={0.1} height={0.38} rx={0.05} fill={WINE} />
        </G>
      );
    case 'gafas':
      return (
        <G>
          <Rect x={-0.66} y={-0.43} width={0.6} height={0.44} rx={0.15} fill={INK} />
          <Rect x={0.06} y={-0.43} width={0.6} height={0.44} rx={0.15} fill={INK} />
          <Line x1={-0.08} y1={-0.3} x2={0.08} y2={-0.3} stroke={INK} strokeWidth={0.06} />
          <Line x1={-0.64} y1={-0.32} x2={-0.95} y2={-0.38} stroke={INK} strokeWidth={0.06} />
          <Line x1={0.64} y1={-0.32} x2={0.95} y2={-0.38} stroke={INK} strokeWidth={0.06} />
          <Line
            x1={-0.52}
            y1={-0.33}
            x2={-0.4}
            y2={-0.33}
            stroke={BONE}
            strokeWidth={0.04}
            strokeLinecap="round"
          />
          <Line
            x1={0.2}
            y1={-0.33}
            x2={0.32}
            y2={-0.33}
            stroke={BONE}
            strokeWidth={0.04}
            strokeLinecap="round"
          />
        </G>
      );
    case 'monoculo':
      return (
        <G>
          <Circle
            cx={0.339}
            cy={-0.205}
            r={0.32}
            stroke={CROWN}
            strokeWidth={0.05}
            fill={BONE}
            fillOpacity={0.2}
          />
          <Path
            d="M 0.62 -0.08 Q 0.78 0.35 0.5 0.72"
            stroke={CROWN}
            strokeWidth={0.025}
            fill="none"
          />
        </G>
      );
    case 'pajarita':
      return (
        <G>
          <Path d="M 0 0.82 L -0.34 0.65 L -0.34 0.99 Z" fill={WINE} strokeLinejoin="round" />
          <Path d="M 0 0.82 L 0.34 0.65 L 0.34 0.99 Z" fill={WINE} strokeLinejoin="round" />
          <Circle cx={0} cy={0.82} r={0.09} fill={WINE} stroke={INK} strokeWidth={0.02} />
        </G>
      );
    case 'bufanda':
      return (
        <G>
          <Path d="M 0.28 0.78 L 0.52 0.8 L 0.5 1.42 L 0.26 1.38 Z" fill={GREEN} />
          <Path d="M -0.8 0.6 Q 0 0.9 0.8 0.6 L 0.66 0.84 Q 0 1.1 -0.66 0.84 Z" fill={GREEN} />
          <Line x1={0.27} y1={1.18} x2={0.51} y2={1.21} stroke={BONE} strokeWidth={0.04} />
          <Line x1={0.27} y1={1.28} x2={0.5} y2={1.31} stroke={BONE} strokeWidth={0.04} />
        </G>
      );
    case 'boina':
      return (
        <G transform="rotate(-10)">
          <Ellipse cx={-0.05} cy={-0.88} rx={0.82} ry={0.25} fill={WINE} />
          <Ellipse cx={-0.05} cy={-0.8} rx={0.66} ry={0.08} fill="#7C2430" />
          <Rect x={-0.08} y={-1.2} width={0.1} height={0.12} rx={0.04} fill={WINE} />
        </G>
      );
    case 'gorra':
      return (
        <G>
          <Path d="M -0.74 -0.6 Q -0.72 -1.2 0 -1.22 Q 0.72 -1.2 0.74 -0.6 Z" fill={BLUE} />
          <Path d="M 0.15 -0.66 Q 0.9 -0.78 1.28 -0.58 Q 0.9 -0.5 0.15 -0.56 Z" fill="#234870" />
          <Circle cx={0} cy={-1.2} r={0.07} fill="#234870" />
        </G>
      );
    case 'vaquero':
      return (
        <G>
          <Path
            d="M -0.52 -0.84 Q -0.58 -1.58 -0.2 -1.52 Q 0 -1.38 0.2 -1.52 Q 0.58 -1.58 0.52 -0.84 Z"
            fill={BROWN}
          />
          <Rect x={-0.53} y={-1.02} width={1.06} height={0.12} fill="#5E3B1A" />
          <Ellipse cx={0} cy={-0.84} rx={1.18} ry={0.14} fill={BROWN} />
        </G>
      );
    case 'lana':
      return (
        <G>
          <Path d="M -0.8 -0.52 Q -0.8 -1.26 0 -1.28 Q 0.8 -1.26 0.8 -0.52 Z" fill={RUST} />
          {[-0.45, -0.15, 0.15, 0.45].map((x) => (
            <Path
              key={x}
              d={`M ${x} -0.66 Q ${x * 0.9} -1.0 ${x * 0.6} -1.2`}
              stroke="#A8402E"
              strokeWidth={0.04}
              fill="none"
            />
          ))}
          <Rect x={-0.85} y={-0.66} width={1.7} height={0.22} rx={0.1} fill="#A8402E" />
          <Circle cx={0} cy={-1.34} r={0.2} fill={BONE} />
        </G>
      );
    case 'vikingo':
      return (
        <G>
          <Path
            d="M -0.7 -0.92 Q -1.25 -1.0 -1.18 -1.65 Q -0.98 -1.18 -0.6 -1.12 Z"
            fill="#EDE3C8"
          />
          <Path d="M 0.7 -0.92 Q 1.25 -1.0 1.18 -1.65 Q 0.98 -1.18 0.6 -1.12 Z" fill="#EDE3C8" />
          <Path d="M -0.8 -0.55 Q -0.8 -1.24 0 -1.26 Q 0.8 -1.24 0.8 -0.55 Z" fill="#8A8F98" />
          <Rect x={-0.84} y={-0.66} width={1.68} height={0.16} rx={0.06} fill="#6C717A" />
          <Rect x={-0.06} y={-1.24} width={0.12} height={0.6} fill="#6C717A" />
        </G>
      );
    case 'flores':
      return (
        <G>
          {arc(7, 0, 0, 0.82, 0.95, -Math.PI * 0.86, -Math.PI * 0.14).map((pt, i) => (
            <G key={i} transform={`translate(${pt.x} ${pt.y})`}>
              {[0, 72, 144, 216, 288].map((a) => (
                <Circle
                  key={a}
                  cx={0.09 * Math.cos((a * Math.PI) / 180)}
                  cy={0.09 * Math.sin((a * Math.PI) / 180)}
                  r={0.08}
                  fill={i % 2 === 0 ? PINK : WHITE}
                />
              ))}
              <Circle r={0.055} fill={CROWN} />
            </G>
          ))}
        </G>
      );
    case 'chef':
      return (
        <G stroke="#D8D2C4" strokeWidth={0.03}>
          <Circle cx={-0.36} cy={-1.3} r={0.33} fill={WHITE} />
          <Circle cx={0.36} cy={-1.3} r={0.33} fill={WHITE} />
          <Circle cx={0} cy={-1.48} r={0.4} fill={WHITE} />
          <Rect x={-0.58} y={-1.1} width={1.16} height={0.3} rx={0.06} fill={WHITE} />
        </G>
      );
    case 'aureola':
      return (
        <Ellipse
          cx={0}
          cy={-1.38}
          rx={0.56}
          ry={0.14}
          stroke="#F7E08A"
          strokeWidth={0.11}
          fill="none"
        />
      );
    case 'mago':
      return (
        <G>
          <Path d="M -0.72 -0.8 L 0.72 -0.8 L 0.3 -1.95 Q 0.15 -2.12 0.02 -1.98 Z" fill="#2B2D6E" />
          <Ellipse cx={0} cy={-0.8} rx={0.95} ry={0.14} fill="#2B2D6E" />
          <Circle cx={-0.2} cy={-1.15} r={0.06} fill={CROWN} />
          <Circle cx={0.25} cy={-1.4} r={0.05} fill={CROWN} />
          <Circle cx={0.05} cy={-1.65} r={0.04} fill={CROWN} />
          <Line x1={-0.6} y1={-0.9} x2={0.6} y2={-0.9} stroke={CROWN} strokeWidth={0.06} />
        </G>
      );
    case 'reno':
      return (
        <G>
          {[-1, 1].map((side) => (
            <Path
              key={side}
              d={`M ${side * 0.45} -0.88 L ${side * 0.72} -1.62 M ${side * 0.6} -1.3 L ${side * 0.98} -1.44 M ${side * 0.68} -1.52 L ${side * 0.48} -1.8 M ${side * 0.52} -1.06 L ${side * 0.3} -1.3`}
              stroke="#7A5230"
              strokeWidth={0.1}
              strokeLinecap="round"
              fill="none"
            />
          ))}
          <Circle cx={0} cy={0.12} r={0.13} fill="#D33A3A" />
          <Circle cx={-0.04} cy={0.08} r={0.035} fill={WHITE} />
        </G>
      );
    case 'redondas':
      return (
        <G stroke="#2B2118" strokeWidth={0.06} fill="none">
          <Circle cx={-0.339} cy={-0.205} r={0.33} fill={BONE} fillOpacity={0.15} />
          <Circle cx={0.339} cy={-0.205} r={0.33} fill={BONE} fillOpacity={0.15} />
          <Path d="M -0.03 -0.24 Q 0 -0.3 0.03 -0.24" />
          <Line x1={-0.67} y1={-0.24} x2={-0.95} y2={-0.32} />
          <Line x1={0.67} y1={-0.24} x2={0.95} y2={-0.32} />
        </G>
      );
    case 'corazones':
      return (
        <G>
          <G transform="translate(-0.34 -0.17) scale(0.62)">
            <Path d={HEART} fill="#D6455D" opacity={0.95} />
          </G>
          <G transform="translate(0.34 -0.17) scale(0.62)">
            <Path d={HEART} fill="#D6455D" opacity={0.95} />
          </G>
          <Line x1={-0.06} y1={-0.24} x2={0.06} y2={-0.24} stroke="#8E2A3A" strokeWidth={0.05} />
          <Line x1={-0.66} y1={-0.24} x2={-0.95} y2={-0.32} stroke="#8E2A3A" strokeWidth={0.05} />
          <Line x1={0.66} y1={-0.24} x2={0.95} y2={-0.32} stroke="#8E2A3A" strokeWidth={0.05} />
        </G>
      );
    case 'antifaz':
      return (
        <Path
          d={`M -0.88 -0.36 Q -0.62 -0.66 -0.2 -0.48 Q 0 -0.4 0.2 -0.48 Q 0.62 -0.66 0.88 -0.36 Q 0.82 0.04 0.4 0.06 Q 0.1 0.02 0 -0.1 Q -0.1 0.02 -0.4 0.06 Q -0.82 0.04 -0.88 -0.36 Z ${ellipsePath(-0.339, -0.205, 0.2, 0.25)} ${ellipsePath(0.339, -0.205, 0.2, 0.25)}`}
          fill={INK}
          fillRule="evenodd"
        />
      );
    case 'parche':
      return (
        <G>
          <Path
            d="M -0.95 -0.62 Q -0.2 -0.66 0.95 0.02"
            stroke={INK}
            strokeWidth={0.05}
            fill="none"
          />
          <Ellipse cx={0.36} cy={-0.2} rx={0.3} ry={0.34} fill={INK} />
        </G>
      );
    case 'corbata':
      return (
        <G>
          <Path d="M -0.11 0.68 L 0.11 0.68 L 0.08 0.84 L -0.08 0.84 Z" fill="#234870" />
          <Path d="M -0.08 0.84 L 0.08 0.84 L 0.17 1.3 L 0 1.44 L -0.17 1.3 Z" fill={BLUE} />
          <Line x1={-0.12} y1={1.0} x2={0.12} y2={1.1} stroke={CROWN} strokeWidth={0.035} />
          <Line x1={-0.15} y1={1.18} x2={0.15} y2={1.28} stroke={CROWN} strokeWidth={0.035} />
        </G>
      );
    case 'perlas':
      return (
        <G>
          {arc(13, 0, 0.62, 0.62, 0.26, 0.12, Math.PI - 0.12).map((pt, i) => (
            <Circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={0.075}
              fill={WHITE}
              stroke="#CFC6B2"
              strokeWidth={0.015}
            />
          ))}
        </G>
      );
    case 'medalla':
      return (
        <G>
          <Path
            d="M -0.36 0.74 L 0 1.06 L 0.36 0.74"
            stroke={WINE}
            strokeWidth={0.12}
            fill="none"
            strokeLinejoin="round"
          />
          <Circle cx={0} cy={1.18} r={0.19} fill={CROWN} stroke="#B88A1E" strokeWidth={0.03} />
          <Path
            d="M 0 1.07 L 0.035 1.15 L 0.12 1.16 L 0.055 1.21 L 0.075 1.3 L 0 1.25 L -0.075 1.3 L -0.055 1.21 L -0.12 1.16 L -0.035 1.15 Z"
            fill="#B88A1E"
          />
        </G>
      );
    case 'panuelo':
      return (
        <G>
          <Path d="M -0.72 0.66 Q 0 0.86 0.72 0.66 L 0 1.22 Z" fill={RUST} />
          {[
            [-0.3, 0.82],
            [0.25, 0.84],
            [0, 0.98],
            [0.12, 1.08],
          ].map(([x, y]) => (
            <Circle key={`${x}-${y}`} cx={x} cy={y} r={0.03} fill={WHITE} />
          ))}
        </G>
      );
    case 'collar-flores':
      return (
        <G>
          {arc(11, 0, 0.62, 0.66, 0.3, 0.1, Math.PI - 0.1).map((pt, i) => (
            <Circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={0.1}
              fill={[PINK, CROWN, '#E58A55', WHITE][i % 4]}
            />
          ))}
        </G>
      );
  }
}

/** Orden de dibujo por sitio: primero el cuello, luego los ojos y encima la cabeza. */
const SLOT_ORDER: Record<Slot, number> = { cuello: 0, ojos: 1, cabeza: 2 };

/** Los accesorios que lleva puestos, cada uno en su capa. */
export function Accessories({ ids }: { ids: AccessoryId[] }) {
  const sorted = [...ids].sort((a, b) => SLOT_ORDER[slotOf(a)] - SLOT_ORDER[slotOf(b)]);
  return (
    <G>
      {sorted.map((id) => (
        <Accessory key={id} id={id} />
      ))}
    </G>
  );
}

function slotOf(id: AccessoryId): Slot {
  const item = itemById(id);
  return item?.kind === 'accesorio' ? item.slot : 'cabeza';
}

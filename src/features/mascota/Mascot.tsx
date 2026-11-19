import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { BALL_R, type Pose } from './pose';

/** Lado (en px del lienzo) del cuadrado centrado en la bola donde se dibujan sus extremidades. */
export const MASCOT_BOX = BALL_R * 7;

/** Colores de la mascota (muestreados de la imagen aprobada por el usuario). */
const GOLD = '#E4BB57';
const MOUTH = '#7A5C12';
const BONE = '#F5F0E3';
const BLACK = '#0B0A09';

/** Un brazo o una pierna: del punto de unión hacia el ángulo dado, con una pequeña curva. */
function limb(hx: number, hy: number, angle: number, length: number, bend: number) {
  const a = (angle * Math.PI) / 180;
  const ex = hx + Math.sin(a) * length;
  const ey = hy + Math.cos(a) * length;
  return { ex, ey, d: `M ${hx} ${hy} Q ${(hx + ex) / 2 + bend} ${(hy + ey) / 2} ${ex} ${ey}` };
}

/**
 * La mascota de Kuentio (bola dorada con brazos y patas) dibujada en un cuadrado centrado en la
 * bola (`MASCOT_BOX`). Su recorrido (x, y, escala, inclinación) lo anima la vista que la envuelve
 * con el driver nativo; aquí solo cambian las extremidades, la cara y el giro.
 * `unit` = puntos de pantalla por píxel del lienzo. Cada transformación va en su propio `G` para
 * no depender de cómo react-native-svg lea varias a la vez. Mismo dibujo que en el proyecto de
 * Remotion `kuentio-mascota` (`src/mascota/Mascota.tsx`).
 */
export function Mascot({ pose, unit }: { pose: Pose; unit: number }) {
  const g = pose.limbs;
  const strokeWidth = 0.24 * Math.min(1, g * 3);
  const small = Math.min(1, g * 2);
  const arms = [
    { side: -1, angle: pose.leftArm },
    { side: 1, angle: pose.rightArm },
  ].map(({ side, angle }) => ({
    side,
    ...limb(side * 0.8, 0.5, angle, 1.4 * g, side * 0.2 * g),
  }));
  const legs = [
    { side: -1, angle: pose.leftLeg },
    { side: 1, angle: pose.rightLeg },
  ].map(({ side, angle }) => ({ side, angle, ...limb(side * 0.29, 0.85, angle, 1.8 * g, 0) }));
  return (
    <Svg
      width={MASCOT_BOX * unit}
      height={MASCOT_BOX * unit}
      viewBox={`${-MASCOT_BOX / 2} ${-MASCOT_BOX / 2} ${MASCOT_BOX} ${MASCOT_BOX}`}
    >
      {/* Posición, inclinación y escala las lleva la vista que lo envuelve (hilo nativo). */}
      <G>
        <G>
          <G transform={`scale(${BALL_R})`}>
            {/* Extremidades detrás de la bola: sus uniones quedan tapadas. */}
            {legs.map((l) => (
              <Path
                key={`l${l.side}`}
                d={l.d}
                stroke={GOLD}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
              />
            ))}
            {arms.map((a) => (
              <Path
                key={`a${a.side}`}
                d={a.d}
                stroke={GOLD}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
              />
            ))}
            {legs.map((l) => (
              <G key={`f${l.side}`} transform={`rotate(${-l.angle * 0.5},${l.ex},${l.ey})`}>
                <Ellipse
                  cx={l.ex + l.side * 0.2}
                  cy={l.ey + 0.02}
                  rx={0.3 * small}
                  ry={0.17 * small}
                  fill={GOLD}
                />
              </G>
            ))}
            {arms.map((a) => (
              <Circle key={`h${a.side}`} cx={a.ex} cy={a.ey} r={0.21 * small} fill={GOLD} />
            ))}
            {/* Bola con cara; se aplasta anclada en su punto más bajo. */}
            <G transform="translate(0,1)">
              <G transform={`scale(${pose.squashX},${pose.squashY})`}>
                <G transform="translate(0,-1)">
                  <G transform={`rotate(${(pose.roll * 180) / Math.PI})`}>
                    <Circle r={1} fill={GOLD} />
                    <Ellipse cx={-0.37} cy={-0.2} rx={0.25} ry={0.4} fill={BONE} />
                    <Ellipse cx={0.37} cy={-0.2} rx={0.25} ry={0.4} fill={BONE} />
                    <Ellipse cx={-0.37 + pose.look} cy={-0.2} rx={0.13} ry={0.24} fill={BLACK} />
                    <Ellipse cx={0.37 + pose.look} cy={-0.2} rx={0.13} ry={0.24} fill={BLACK} />
                    <G transform="translate(0,0.3)">
                      <G transform={`scale(${1 + 0.15 * (pose.mouth - 1)},${pose.mouth})`}>
                        <G transform="translate(0,-0.3)">
                          <Path
                            d="M -0.34 0.3 L 0.34 0.3 Q 0.37 0.3 0.33 0.38 Q 0 0.72 -0.33 0.38 Q -0.37 0.3 -0.34 0.3 Z"
                            fill={MOUTH}
                          />
                        </G>
                      </G>
                    </G>
                  </G>
                </G>
              </G>
            </G>
          </G>
        </G>
      </G>
    </Svg>
  );
}

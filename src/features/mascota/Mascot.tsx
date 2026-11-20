import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import {
  BONE,
  BLACK,
  EYE_RX,
  EYE_RY,
  EYE_X,
  EYE_Y,
  GOLD,
  MOUTH,
  MOUTH_PATH,
  PUPIL_RX,
  PUPIL_RY,
} from './face';
import { BALL_R, type Pose } from './pose';

/** Lado (en px del lienzo) del cuadrado centrado en la bola donde se dibujan sus extremidades. */
export const MASCOT_BOX = BALL_R * 7;

/** Zona que se dibuja, en radios de la bola respecto a su centro (por defecto, `MASCOT_BOX`). */
export type MascotView = { left: number; top: number; width: number; height: number };

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
 * Remotion `kuentio-mascota` (`src/mascota/Mascota.tsx`); la cara es la del icono (`face.ts`).
 * Con `placed`, el propio dibujo aplica la posición, la inclinación y la escala de la pose (así se
 * mueve en el tutorial); sin él las lleva la vista que lo envuelve (celebración de la racha).
 * `view` recorta la zona dibujada (por defecto, el cuadrado `MASCOT_BOX`). `children` se dibuja
 * encima de la bola con sus mismas unidades (radio = 1, origen en el centro): los accesorios.
 */
export function Mascot({
  pose,
  unit,
  view,
  placed = false,
  children,
}: {
  pose: Pose;
  unit: number;
  view?: MascotView;
  placed?: boolean;
  children?: ReactNode;
}) {
  const box = view ?? { left: -3.5, top: -3.5, width: 7, height: 7 };
  const lookY = pose.lookY ?? 0;
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
      width={box.width * BALL_R * unit}
      height={box.height * BALL_R * unit}
      viewBox={`${box.left * BALL_R} ${box.top * BALL_R} ${box.width * BALL_R} ${box.height * BALL_R}`}
    >
      {/* Sin `placed`, posición, inclinación y escala las lleva la vista que lo envuelve. */}
      <G transform={placed ? `translate(${pose.x},${pose.y})` : undefined}>
        <G transform={placed ? `rotate(${pose.tilt})` : undefined}>
          <G transform={`scale(${(placed ? pose.scale : 1) * BALL_R})`}>
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
                    <Ellipse cx={-EYE_X} cy={EYE_Y} rx={EYE_RX} ry={EYE_RY} fill={BONE} />
                    <Ellipse cx={EYE_X} cy={EYE_Y} rx={EYE_RX} ry={EYE_RY} fill={BONE} />
                    <Ellipse
                      cx={-EYE_X + pose.look}
                      cy={EYE_Y + lookY}
                      rx={PUPIL_RX}
                      ry={PUPIL_RY}
                      fill={BLACK}
                    />
                    <Ellipse
                      cx={EYE_X + pose.look}
                      cy={EYE_Y + lookY}
                      rx={PUPIL_RX}
                      ry={PUPIL_RY}
                      fill={BLACK}
                    />
                    <G transform="translate(0,0.3)">
                      <G transform={`scale(${1 + 0.15 * (pose.mouth - 1)},${pose.mouth})`}>
                        <G transform="translate(0,-0.3)">
                          <Path d={MOUTH_PATH} fill={MOUTH} />
                        </G>
                      </G>
                    </G>
                    {children}
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

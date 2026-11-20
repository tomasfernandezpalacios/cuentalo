import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import {
  BLACK,
  BONE,
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

/**
 * La cara de la mascota quieta (la del icono), en un círculo de `size` puntos. Con `color`, la
 * bola toma ese color (en la barra de pestañas: gris si no está elegida). `children` se dibuja
 * encima con las unidades de la bola (accesorios); `viewBox` amplía la zona para que quepan
 * (entonces `size` es el ancho y el alto sale de su proporción).
 */
export function MascotFace({
  size,
  color = GOLD,
  viewBox,
  children,
}: {
  size: number;
  color?: string;
  viewBox?: { left: number; top: number; width: number; height: number };
  children?: ReactNode;
}) {
  const box = viewBox ?? { left: -1.02, top: -1.02, width: 2.04, height: 2.04 };
  return (
    <Svg
      width={size}
      height={(size * box.height) / box.width}
      viewBox={`${box.left} ${box.top} ${box.width} ${box.height}`}
    >
      <Circle r={1} fill={color} />
      <Ellipse cx={-EYE_X} cy={EYE_Y} rx={EYE_RX} ry={EYE_RY} fill={BONE} />
      <Ellipse cx={EYE_X} cy={EYE_Y} rx={EYE_RX} ry={EYE_RY} fill={BONE} />
      <Ellipse cx={-EYE_X + 0.02} cy={EYE_Y} rx={PUPIL_RX} ry={PUPIL_RY} fill={BLACK} />
      <Ellipse cx={EYE_X + 0.02} cy={EYE_Y} rx={PUPIL_RX} ry={PUPIL_RY} fill={BLACK} />
      <G>
        <Path d={MOUTH_PATH} fill={color === GOLD ? MOUTH : BLACK} />
      </G>
      {children}
    </Svg>
  );
}

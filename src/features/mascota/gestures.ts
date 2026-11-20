// Gestos de la mascota para el tutorial: una postura y un movimiento por mensaje, como si cada
// paso lo dijera ella. Función pura `gesture(nombre, fotograma)` → Pose, sin Remotion ni React, para
// llevarla tal cual a la app. Viene del proyecto de Remotion `kuentio-mascota`
// (`src/mascota/gestos.ts`): si cambia allí, cambiarlo aquí también.
//
// Cada gesto empieza saliendo con un pequeño rebote (`enter`) y después se repite sin parar.
// Unidades: fotogramas a 30 fps; los saltos están en radios de la bola (`y` en píxeles del lienzo,
// con BALL_R = 70). Ángulos de brazos: 0 = colgando, 180 = arriba, positivo hacia la derecha.

import { BALL_R, type Pose } from './pose';

export type Gesture =
  | 'wave' // saluda con la mano
  | 'hello' // llega rodando y saluda
  | 'pointUp' // señala hacia arriba
  | 'pointDown' // señala hacia abajo
  | 'think' // se rasca la cabeza
  | 'cheer' // salta con los brazos en alto
  | 'hop' // saltitos
  | 'oops' // se encoge de hombros
  | 'press' // se aplasta aguantando
  | 'present' // «¡tachán!»
  | 'read' // mira de lado a lado
  | 'friends' // saluda con las dos manos
  | 'fire'; // salta nervioso, emocionado

export const GESTURES: Gesture[] = [
  'wave',
  'hello',
  'pointUp',
  'pointDown',
  'think',
  'cheer',
  'hop',
  'oops',
  'press',
  'present',
  'read',
  'friends',
  'fire',
];

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c = 2;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Postura de reposo: respira un poco. */
const rest = (f: number): Pose => ({
  x: 0,
  y: 0,
  scale: 1,
  roll: 0,
  squashX: 1 - 0.01 * Math.sin(0.15 * f),
  squashY: 1 + 0.02 * Math.sin(0.15 * f),
  limbs: 1,
  leftArm: -10,
  rightArm: 10,
  leftLeg: -3,
  rightLeg: 3,
  mouth: 1,
  look: 0.02,
  lookY: 0,
  tilt: 0,
});

/** Salto repetido: altura (0–1) en el fotograma f y cuánto se aplasta al caer o al impulsarse. */
function jump(f: number, period: number) {
  const u = (f % period) / period;
  const height = 4 * u * (1 - u);
  const squash = u < 0.15 ? (0.15 - u) / 0.15 : u > 0.85 ? (u - 0.85) / 0.15 : 0;
  return { height, squash };
}

export const gesturePose = (g: Gesture, f: number): Pose => {
  const p = rest(f);
  switch (g) {
    case 'wave':
      return {
        ...p,
        y: -0.12 * BALL_R * Math.abs(Math.sin(0.17 * f)),
        rightArm: 150 + 22 * Math.sin(0.55 * f),
        mouth: 1.45,
        look: 0.05,
        tilt: 3 * Math.sin(0.2 * f),
      };
    case 'hello': {
      const spin = clamp01(f / 16);
      const arm = easeOut(clamp01((f - 14) / 8));
      return {
        ...p,
        y: -0.4 * BALL_R * Math.sin(Math.PI * spin),
        roll: TAU * easeOut(spin),
        rightArm: 8 + 142 * arm + 22 * arm * Math.sin(0.55 * f),
        mouth: 1.4,
        tilt: 3 * arm * Math.sin(0.2 * f),
      };
    }
    case 'pointUp': {
      const tap = Math.sin(0.28 * f);
      return {
        ...p,
        y: -0.04 * BALL_R * tap,
        leftArm: -8,
        rightArm: 138 + 7 * tap,
        mouth: 1.15,
        look: 0.08,
        lookY: -0.1,
        tilt: 5,
      };
    }
    case 'pointDown': {
      const tap = Math.sin(0.28 * f);
      return {
        ...p,
        y: -0.04 * BALL_R * tap,
        leftArm: -8,
        rightArm: 40 + 7 * tap,
        mouth: 1.15,
        look: 0.08,
        lookY: 0.1,
        tilt: 5,
      };
    }
    case 'think':
      return {
        ...p,
        leftArm: -8,
        rightArm: 158 + 9 * Math.sin(0.5 * f),
        mouth: 0.55,
        look: -0.08,
        lookY: -0.1,
        tilt: 9 + 2 * Math.sin(0.1 * f),
      };
    case 'cheer': {
      const { height, squash } = jump(f, 20);
      const arm = 165 + 10 * Math.sin(0.7 * f);
      return {
        ...p,
        y: -height * BALL_R,
        squashX: 1 + 0.12 * squash,
        squashY: 1 - 0.16 * squash,
        leftArm: -arm,
        rightArm: arm,
        leftLeg: -(8 + 14 * height),
        rightLeg: 8 + 14 * height,
        mouth: 1.8,
        lookY: -0.04,
        tilt: 4 * Math.sin(0.3 * f),
      };
    }
    case 'hop': {
      const { height, squash } = jump(f, 22);
      return {
        ...p,
        y: -0.45 * height * BALL_R,
        squashX: 1 + 0.1 * squash,
        squashY: 1 - 0.13 * squash,
        leftArm: -(30 + 40 * height),
        rightArm: 30 + 40 * height,
        leftLeg: -(5 + 10 * height),
        rightLeg: 5 + 10 * height,
        mouth: 1.35,
      };
    }
    case 'oops': {
      const shoulders = 38 + 4 * Math.sin(0.4 * f);
      return {
        ...p,
        y: -0.05 * BALL_R * Math.sin(0.5 * f),
        squashY: 0.97,
        leftArm: -shoulders,
        rightArm: shoulders,
        mouth: 0.5,
        look: 0.08 * Math.sin(0.22 * f),
        lookY: 0.06,
        tilt: 7 * Math.sin(0.16 * f),
      };
    }
    case 'press': {
      const q = f % 90;
      const sink = q < 14 ? easeOut(q / 14) : q < 50 ? 1 : q < 62 ? 1 - easeOut((q - 50) / 12) : 0;
      const shake = q >= 14 && q < 50 ? 0.012 * Math.sin(1.6 * q) : 0;
      const bounce = q >= 50 && q < 66 ? 0.12 * Math.sin((Math.PI * (q - 50)) / 16) : 0;
      return {
        ...p,
        y: -bounce * 0.3 * BALL_R,
        squashX: 1 + 0.12 * sink - 0.5 * bounce,
        squashY: 1 - 0.18 * sink + shake + bounce,
        leftArm: -(14 + 26 * sink),
        rightArm: 14 + 26 * sink,
        leftLeg: -(6 + 20 * sink),
        rightLeg: 6 + 20 * sink,
        mouth: 1 - 0.45 * sink,
        lookY: 0.1 * sink,
      };
    }
    case 'present': {
      const sweep = easeOutBack(clamp01((f - 2) / 12));
      return {
        ...p,
        y: -0.35 * BALL_R * Math.sin(Math.PI * clamp01(f / 14)),
        leftArm: -8,
        rightArm: mix(40, 135, sweep) + 4 * Math.sin(0.3 * f),
        mouth: 1.5,
        look: 0.08,
        tilt: -5,
      };
    }
    case 'read':
      return {
        ...p,
        y: -0.03 * BALL_R * Math.sin(0.4 * f),
        rightArm: 118 + 5 * Math.sin(0.2 * f),
        mouth: 1.1,
        look: 0.085 * Math.sin(0.2 * f),
        lookY: 0.02,
        tilt: 3 * Math.sin(0.2 * f - 0.5),
      };
    case 'friends': {
      const swing = Math.sin(0.45 * f);
      return {
        ...p,
        y: -0.12 * BALL_R * Math.abs(Math.sin(0.225 * f)),
        leftArm: -(150 + 22 * swing),
        rightArm: 150 - 22 * swing,
        mouth: 1.55,
        tilt: 8 * Math.sin(0.225 * f),
      };
    }
    case 'fire': {
      const { height, squash } = jump(f, 10);
      const arm = 165 + 14 * Math.sin(0.9 * f);
      return {
        ...p,
        y: -0.35 * height * BALL_R,
        squashX: 1 + 0.08 * squash,
        squashY: 1 - 0.1 * squash,
        leftArm: -arm,
        rightArm: arm,
        leftLeg: -(6 + 10 * height),
        rightLeg: 6 + 10 * height,
        mouth: 1.8,
        lookY: -0.1,
        tilt: 5 * Math.sin(0.9 * f),
      };
    }
  }
};

/** Postura del gesto en el fotograma f: sale con un rebote y sigue con su movimiento. */
export const gesture = (g: Gesture, f: number): Pose => {
  const p = gesturePose(g, f);
  const enter = Math.max(0.001, easeOutBack(clamp01(f / 9)));
  return { ...p, scale: p.scale * enter };
};

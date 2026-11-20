// Animaciones de la mascota para «Progreso» (las que se desbloquean y se eligen en la tienda).
// Función pura `animation(nombre, fotograma)` → Pose, como los gestos del tutorial
// (`gestures.ts`). Vienen del proyecto de Remotion `kuentio-mascota`
// (`src/mascota/animaciones.ts`, vista previa `KuentioMascotaAnimaciones` y su hoja): si cambian
// allí, cambiarlas aquí también (el cuerpo es el mismo; allí un adaptador pasa la pose a los
// nombres en español).
//
// Unidades: fotogramas a 30 fps; distancias en radios de la bola (`BALL`). Ángulos de brazos y
// piernas: 0 = colgando, 180 = arriba, positivo hacia la derecha. Cada una empieza con un rebote
// y se repite sin parar.

import { BALL_R, type Pose } from './pose';

const BALL = BALL_R;

export type Dance =
  | 'dance' // baila de lado a lado
  | 'spin' // pirueta
  | 'backflip' // voltereta en el aire
  | 'march' // marcha en el sitio
  | 'robot' // baile robot, a golpes
  | 'disco' // dedo arriba, dedo abajo
  | 'clap' // aplaude por encima de la cabeza
  | 'hula' // hula hoop
  | 'karate' // patada de kárate
  | 'jacks' // saltos de tijera
  | 'jelly' // gelatina
  | 'bow' // reverencia
  | 'trampoline' // supersalto
  | 'laugh' // carcajada
  | 'shy'; // tímida

export const DANCES: Dance[] = [
  'dance',
  'spin',
  'backflip',
  'march',
  'robot',
  'disco',
  'clap',
  'hula',
  'karate',
  'jacks',
  'jelly',
  'bow',
  'trampoline',
  'laugh',
  'shy',
];

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t: number) => {
  const c = 2;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

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

/** Salto repetido de periodo `period`: altura (0–1) y aplastamiento al caer o impulsarse. */
function jump(f: number, period: number) {
  const u = (f % period) / period;
  const height = 4 * u * (1 - u);
  const squash = u < 0.15 ? (0.15 - u) / 0.15 : u > 0.85 ? (u - 0.85) / 0.15 : 0;
  return { u, height, squash };
}

export const dancePose = (d: Dance, f: number): Pose => {
  const p = rest(f);
  switch (d) {
    case 'dance': {
      const beat = Math.sin(0.22 * f);
      const bounce = Math.abs(Math.sin(0.22 * f));
      return {
        ...p,
        x: 0.35 * BALL * beat,
        y: -0.18 * BALL * bounce,
        leftArm: -(100 + 60 * Math.max(0, beat)),
        rightArm: 100 + 60 * Math.max(0, -beat),
        leftLeg: -(4 + 10 * Math.max(0, beat)),
        rightLeg: 4 + 10 * Math.max(0, -beat),
        mouth: 1.5,
        look: 0.07 * beat,
        tilt: 10 * beat,
      };
    }
    case 'spin': {
      const q = (f % 45) / 45;
      const turn = easeInOut(clamp01(q / 0.7));
      return {
        ...p,
        y: -0.5 * BALL * Math.sin(Math.PI * clamp01(q / 0.7)),
        roll: TAU * turn,
        leftArm: -(60 + 90 * Math.sin(Math.PI * turn)),
        rightArm: 60 + 90 * Math.sin(Math.PI * turn),
        leftLeg: -12,
        rightLeg: 12,
        mouth: 1.5,
        tilt: 0,
      };
    }
    case 'backflip': {
      const { u, height, squash } = jump(f, 40);
      return {
        ...p,
        y: -1.3 * BALL * height,
        squashX: 1 + 0.14 * squash,
        squashY: 1 - 0.18 * squash,
        roll: -TAU * easeInOut(u),
        leftArm: -(40 + 120 * height),
        rightArm: 40 + 120 * height,
        leftLeg: -(6 + 30 * height),
        rightLeg: 6 + 30 * height,
        mouth: 1.7,
      };
    }
    case 'march': {
      const step = Math.sin(0.3 * f);
      return {
        ...p,
        y: -0.08 * BALL * Math.abs(step),
        leftArm: -(10 + 45 * Math.max(0, step)),
        rightArm: 10 + 45 * Math.max(0, -step),
        leftLeg: -(3 + 38 * Math.max(0, -step)),
        rightLeg: 3 + 38 * Math.max(0, step),
        mouth: 1.2,
        look: 0.05,
        tilt: 3 * step,
      };
    }
    case 'robot': {
      // A golpes: cada 8 fotogramas cambia de postura sin transición.
      const poses = [
        [-90, 10, 0],
        [-90, 90, -8],
        [-180, 90, 0],
        [-10, 180, 8],
        [-90, 180, 0],
        [-90, 90, -8],
      ];
      const pose = poses[Math.floor(f / 8) % poses.length] ?? [-90, 90, 0];
      return {
        ...p,
        squashX: 1,
        squashY: 1,
        leftArm: pose[0] ?? -90,
        rightArm: pose[1] ?? 90,
        mouth: 0.8,
        look: (Math.floor(f / 16) % 2 === 0 ? 1 : -1) * 0.08,
        tilt: pose[2] ?? 0,
      };
    }
    case 'disco': {
      const up = Math.floor(f / 12) % 2 === 0;
      const sway = Math.sin(0.26 * f);
      return {
        ...p,
        x: 0.15 * BALL * sway,
        y: -0.06 * BALL * Math.abs(sway),
        leftArm: up ? -15 : -30,
        rightArm: up ? 150 : 40,
        leftLeg: -8,
        rightLeg: 10 + 8 * Math.max(0, sway),
        mouth: 1.4,
        look: up ? 0.08 : -0.04,
        lookY: up ? -0.1 : 0.06,
        tilt: up ? -8 : 6,
      };
    }
    case 'clap': {
      const c = Math.abs(Math.sin(0.4 * f));
      return {
        ...p,
        y: -0.06 * BALL * c,
        leftArm: -(150 + 22 * c),
        rightArm: 150 + 22 * c,
        mouth: 1.6,
        lookY: -0.08,
        tilt: 2 * Math.sin(0.2 * f),
      };
    }
    case 'hula': {
      const w = Math.sin(0.5 * f);
      return {
        ...p,
        x: 0.12 * BALL * w,
        squashX: 1 + 0.06 * w,
        squashY: 1 - 0.04 * w,
        leftArm: -125,
        rightArm: 125,
        leftLeg: -6 + 6 * w,
        rightLeg: 6 + 6 * w,
        mouth: 1.4,
        look: -0.06 * w,
        tilt: 6 * Math.sin(0.5 * f + 1),
      };
    }
    case 'karate': {
      const q = f % 50;
      const kick = q < 8 ? easeOutBack(q / 8) : q < 22 ? 1 : q < 30 ? 1 - (q - 22) / 8 : 0;
      return {
        ...p,
        y: -0.1 * BALL * kick,
        leftArm: -(70 + 40 * kick),
        rightArm: 110 - 50 * kick,
        leftLeg: -6,
        rightLeg: 6 + 80 * kick,
        mouth: 0.8 + 0.8 * kick,
        look: 0.1,
        tilt: -12 * kick,
      };
    }
    case 'jacks': {
      const { height, squash } = jump(f, 18);
      return {
        ...p,
        y: -0.4 * BALL * height,
        squashX: 1 + 0.08 * squash,
        squashY: 1 - 0.1 * squash,
        leftArm: -(30 + 140 * height),
        rightArm: 30 + 140 * height,
        leftLeg: -(4 + 30 * height),
        rightLeg: 4 + 30 * height,
        mouth: 1.3,
      };
    }
    case 'jelly': {
      const w = Math.sin(0.55 * f);
      const decay = 0.6 + 0.4 * Math.abs(Math.sin(0.06 * f));
      return {
        ...p,
        squashX: 1 + 0.16 * w * decay,
        squashY: 1 - 0.16 * w * decay,
        leftArm: -(20 + 25 * w),
        rightArm: 20 + 25 * w,
        mouth: 1.3,
        look: 0.04 * w,
      };
    }
    case 'bow': {
      const q = f % 80;
      const down =
        q < 16 ? easeInOut(q / 16) : q < 40 ? 1 : q < 56 ? 1 - easeInOut((q - 40) / 16) : 0;
      return {
        ...p,
        y: 0.05 * BALL * down,
        leftArm: -(10 + 20 * down),
        rightArm: 10 + 70 * down,
        mouth: 1.2,
        lookY: 0.12 * down,
        tilt: 28 * down,
      };
    }
    case 'trampoline': {
      const { height, squash } = jump(f, 34);
      return {
        ...p,
        y: -1.9 * BALL * height,
        squashX: 1 + 0.22 * squash,
        squashY: 1 - 0.26 * squash,
        leftArm: -(20 + 150 * height),
        rightArm: 20 + 150 * height,
        leftLeg: -(4 + 16 * height),
        rightLeg: 4 + 16 * height,
        mouth: 1 + 0.9 * height,
        lookY: -0.12 * height,
      };
    }
    case 'laugh': {
      const shake = Math.abs(Math.sin(0.9 * f));
      return {
        ...p,
        y: -0.08 * BALL * shake,
        squashY: 1 - 0.04 * shake,
        leftArm: -(25 + 10 * shake),
        rightArm: 25 + 10 * shake,
        mouth: 1.9 + 0.2 * shake,
        lookY: -0.08,
        tilt: -10 + 4 * Math.sin(0.45 * f),
      };
    }
    case 'shy': {
      const s = Math.sin(0.12 * f);
      return {
        ...p,
        x: 0.05 * BALL * s,
        squashY: 0.97,
        leftArm: -4,
        rightArm: 4,
        leftLeg: 4,
        rightLeg: -4,
        mouth: 0.6,
        look: -0.09,
        lookY: 0.08,
        tilt: 8 + 3 * s,
      };
    }
  }
};

/** Postura de la animación en el fotograma f: sale con un rebote y sigue con su movimiento. */
export const dance = (d: Dance, f: number): Pose => {
  const p = dancePose(d, f);
  const enter = Math.max(0.001, easeOutBack(clamp01(f / 9)));
  return { ...p, scale: p.scale * enter };
};

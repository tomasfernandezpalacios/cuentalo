/**
 * Movimiento de la mascota en la celebración de la racha (petición del usuario). Función pura
 * `pose(frame)` → postura, sin React ni animaciones de RN, para poder probarla. Viene del proyecto
 * de Remotion `kuentio-mascota` (`src/mascota/pose.ts`): si cambia el movimiento allí, cambiarlo
 * aquí también.
 *
 * Guion: la bola entra rodando rápido desde la izquierda por la barra de pestañas; al haber
 * recorrido el 70 % de la barra salta sin frenar: conserva la velocidad horizontal y sube y baja en
 * una parábola. En el aire le salen piernas y brazos, celebra y sale por la derecha antes de caer.
 *
 * Unidades: píxeles de un lienzo de 1080 de ancho a 30 fps, el mismo del vídeo. La barra va de
 * `BAR_X0` a `BAR_X1` y su centro vertical es `LINE_Y`; la app lo escala al ancho real de la barra.
 */

export const FPS = 30;
export const FRAME_MS = 1000 / FPS;
export const CANVAS_WIDTH = 1080;
export const BALL_R = 70; // radio de la bola rodando
const BIG = 1.3; // escala en el aire
export const LINE_Y = 1773; // centro vertical de la barra

export const BAR_X0 = 16;
export const BAR_X1 = 1064;
const JUMP_AT = 0.7; // fracción de la barra recorrida al saltar
export const JUMP_X = BAR_X0 + JUMP_AT * (BAR_X1 - BAR_X0);
export const CENTER_X = (BAR_X0 + BAR_X1) / 2; // donde está el número de la racha

const ROLL_FRAMES = 32;
/** Velocidad horizontal, en px por fotograma (constante, también en el aire). */
export const SPEED = (JUMP_X + BALL_R) / ROLL_FRAMES;
/** Fotograma en que la bola pasa por encima del número (centro de la barra). */
export const CENTER_FRAME = (CENTER_X + BALL_R) / SPEED;

// Parábola del salto: altura máxima sobre la barra y fotograma (desde el despegue) en que se alcanza.
const PEAK_HEIGHT = 360;
const PEAK_AT = 11.5;
const VY0 = (2 * PEAK_HEIGHT) / PEAK_AT; // velocidad vertical inicial (hacia arriba)
const GRAVITY = VY0 / PEAK_AT; // px por fotograma²
const EXIT_X = CANVAS_WIDTH + 2 * BALL_R * BIG; // a partir de aquí ya no se ve

/** Zona del lienzo que se dibuja: de lo más alto del salto hasta la barra. */
export const VIEW_TOP = 1150;
export const VIEW_HEIGHT = 760;

export type Pose = {
  x: number;
  y: number;
  /** Escala (1 = bola rodando). */
  scale: number;
  /** Giro de la bola, en radianes. */
  roll: number;
  /** Aplastamiento de la bola. */
  squashX: number;
  squashY: number;
  /** 0 = sin extremidades, 1 = enteras. */
  limbs: number;
  /** Ángulo desde «abajo» (0) hasta «arriba» (180); positivo hacia la derecha. */
  leftArm: number;
  rightArm: number;
  leftLeg: number;
  rightLeg: number;
  /** 1 = sonrisa normal, > 1 = abierta. */
  mouth: number;
  /** Desplazamiento horizontal de las pupilas. */
  look: number;
  /** Desplazamiento vertical de las pupilas (negativo = arriba). */
  lookY?: number;
  /** Inclinación, en grados. */
  tilt: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c = 2;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Fotograma (decimal) en que la bola sale por la derecha y termina la animación. */
export const END_FRAME = ROLL_FRAMES + (EXIT_X - JUMP_X) / SPEED;

/** Fracción de la barra ya recorrida por la bola (0–1): la zona que se vuelve naranja. */
export function coverFraction(x: number): number {
  return clamp01((x - BAR_X0) / (BAR_X1 - BAR_X0));
}

/** Postura en el fotograma `f` (puede ser decimal), o null si la bola aún no entra o ya salió. */
export function pose(f: number): Pose | null {
  if (f < 0) return null;
  const base: Pose = {
    x: 0,
    y: LINE_Y,
    scale: 1,
    roll: 0,
    squashX: 1,
    squashY: 1,
    limbs: 0,
    leftArm: -8,
    rightArm: 8,
    leftLeg: 0,
    rightLeg: 0,
    mouth: 1,
    look: 0.07,
    tilt: 0,
  };

  // 1) Rueda a velocidad constante; el giro sale de la distancia recorrida.
  if (f < ROLL_FRAMES) {
    const x = -BALL_R + SPEED * f;
    return { ...base, x, roll: (x + BALL_R) / BALL_R };
  }

  // 2) Vuelo: la velocidad horizontal no cambia; la altura sigue una parábola.
  const t = f - ROLL_FRAMES;
  const x = JUMP_X + SPEED * t;
  if (x > EXIT_X) return null;
  const y = LINE_Y - VY0 * t + 0.5 * GRAVITY * t * t;
  const vy = -VY0 + GRAVITY * t; // hacia abajo positivo
  const rolled = (JUMP_X + BALL_R) / BALL_R;
  const upright = Math.ceil(rolled / (2 * Math.PI)) * 2 * Math.PI; // de cara al salir
  const stretch = t < 4 ? 1 - t / 4 : 0; // se estira al despegar
  const raise = easeOut(clamp01((t - 2) / 6));
  const wave = Math.sin(0.9 * t) * raise;
  const arm = 8 + 132 * raise + 22 * wave;
  return {
    ...base,
    x,
    y,
    scale: mix(1, BIG, easeOut(clamp01(t / 8))),
    roll: mix(rolled, upright, easeOut(clamp01(t / 8))),
    squashX: 1 - 0.14 * stretch,
    squashY: 1 + 0.2 * stretch,
    limbs: easeOutBack(clamp01((t - 1) / 6)),
    leftArm: -arm,
    rightArm: arm,
    leftLeg: -15 * raise + 14 * wave,
    rightLeg: 15 * raise - 14 * wave,
    mouth: 1 + 0.6 * raise,
    look: 0.09,
    tilt: 0.15 * ((Math.atan2(vy, SPEED) * 180) / Math.PI),
  };
}

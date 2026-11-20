import { dance, DANCES, type Dance } from './animations';
import { gesture, type Gesture } from './gestures';
import type { Pose } from './pose';

/** Cualquier movimiento de la mascota: un gesto del tutorial o una animación de la tienda. */
export type Move = Gesture | Dance;

function isDance(name: Move): name is Dance {
  return (DANCES as string[]).includes(name);
}

/** Postura del movimiento en el fotograma f. */
export function move(name: Move, f: number): Pose {
  return isDance(name) ? dance(name, f) : gesture(name, f);
}

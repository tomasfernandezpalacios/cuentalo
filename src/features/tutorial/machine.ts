// Fases de cada paso del tutorial. Función pura para poder testearla.
//
// Cada paso pasa siempre por las mismas fases, en orden, y una no empieza hasta que termina la
// anterior:
//
//   leaving  → se va lo del paso anterior: bocadillo y anillo (y el hueco se cierra si se cambia
//              de pantalla). Nunca se mueve nada más a la vez.
//   waiting  → todo quieto y apagado hasta que la pantalla del paso está abierta del todo y su
//              elemento montado (sin medir ni mover nada mientras tanto).
//   entering → una sola medida y un único movimiento: el foco se desliza y, al llegar, aparece el
//              bocadillo.
//   active   → el paso está a la vista: late el anillo y se puede tocar lo iluminado.
//
// Un paso nuevo (o «Saltar») corta lo que esté en marcha y vuelve a empezar desde «leaving».

export type Phase = 'leaving' | 'waiting' | 'entering' | 'active';

export type PhaseEvent =
  /** Ha cambiado el paso, o la app pide irse ya (p. ej. mientras se crea el contador). */
  | 'leave'
  /** Ha terminado la animación de salida. */
  | 'left'
  /** La pantalla y el elemento del paso están listos. */
  | 'ready'
  /** El foco ha llegado y el bocadillo ha aparecido. */
  | 'entered';

/** Fase siguiente. Un evento que no toca en la fase actual (llega tarde) no cambia nada. */
export function nextPhase(phase: Phase, event: PhaseEvent): Phase {
  switch (event) {
    case 'leave':
      return 'leaving';
    case 'left':
      return phase === 'leaving' ? 'waiting' : phase;
    case 'ready':
      return phase === 'waiting' ? 'entering' : phase;
    case 'entered':
      return phase === 'entering' ? 'active' : phase;
  }
}

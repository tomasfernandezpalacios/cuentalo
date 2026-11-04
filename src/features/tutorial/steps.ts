// Pasos del tutorial de bienvenida y cómo se avanza. Funciones puras para poder testearlas.

/** Elementos de la app que el tutorial puede iluminar (ver TutorialTarget). */
export type TargetId =
  'nuevo-contador' | 'sumar' | 'tarjeta' | 'racha' | 'tab-estadisticas' | 'tab-social';

/** Acciones reales que hacen avanzar un paso (las avisa el código que ya existe). */
export type TutorialEvent = 'counter-created' | 'entry-added';

export type StepId = 'welcome' | 'create' | 'add' | 'tips' | 'streak' | 'stats' | 'social';

export type Step = {
  id: StepId;
  title: string;
  text: string;
  /** Elemento iluminado; sin él, el paso ocupa toda la pantalla (bienvenida). */
  target?: TargetId;
  /** Paso de acción: no hay «Siguiente», se avanza al hacer esto (y solo se toca el hueco). */
  action?: TutorialEvent;
};

const ALL_STEPS: Step[] = [
  {
    id: 'welcome',
    title: '¡Te damos la bienvenida a Cuéntalo! 👋',
    text: 'Aquí cuentas cualquier cosa: cafés, km, libros, días sin fumar… Te lo enseñamos en un minuto.',
  },
  {
    id: 'create',
    title: 'Crea tu primer contador',
    text: 'Toca el + para crearlo. Te daremos algunas ideas.',
    target: 'nuevo-contador',
    action: 'counter-created',
  },
  {
    id: 'add',
    title: 'Suma con un toque',
    text: 'Cada toque suma y queda guardado en tu historial. ¡Pruébalo!',
    target: 'sumar',
    action: 'entry-added',
  },
  {
    id: 'tips',
    title: 'Trucos de la tarjeta',
    text: 'Mantén pulsado el primer botón para escribir otra cantidad, toca la tarjeta para ver el historial y mantenla pulsada para seleccionar.',
    target: 'tarjeta',
  },
  {
    id: 'streak',
    title: 'Tu racha 🔥',
    text: 'Registra algo cada día para no perder tu racha.',
    target: 'racha',
  },
  {
    id: 'stats',
    title: 'Estadísticas',
    text: 'Aquí verás tu evolución en gráficas.',
    target: 'tab-estadisticas',
  },
  {
    id: 'social',
    title: 'Amigos y grupos',
    text: 'Crea un grupo o únete con un código y competid en la clasificación. ¡Listo! Puedes repetir el tutorial en Configuración.',
    target: 'tab-social',
  },
];

/** Pasos para este usuario: si ya tiene contadores, no hace falta crear uno. */
export function buildSteps(hasCounters: boolean): Step[] {
  return ALL_STEPS.filter((step) => !(hasCounters && step.id === 'create'));
}

/** Índice del paso siguiente al pulsar «Siguiente» (null si era el último: se termina). */
export function nextIndex(steps: Step[], index: number): number | null {
  return index + 1 < steps.length ? index + 1 : null;
}

/** ¿Hace avanzar este evento el paso actual? Solo si es justo la acción que pide. */
export function advancesOn(step: Step | undefined, event: TutorialEvent): boolean {
  return step?.action === event;
}

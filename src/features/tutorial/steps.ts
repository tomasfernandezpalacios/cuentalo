// Pasos del tutorial de bienvenida y cómo se avanza. Funciones puras para poder testearlas.

/**
 * Elementos de la app que el tutorial puede iluminar (ver TutorialTarget). 'pantalla' no es un
 * elemento: es la pantalla entera (menos la cabecera y la barra de pestañas), para presentarla.
 */
export type TargetId =
  | 'nuevo-contador'
  | 'nombre'
  | 'crear-contador'
  | 'sumar'
  | 'restar'
  | 'tarjeta'
  | 'herramientas'
  | 'racha'
  | 'tab-estadisticas'
  | 'tab-social'
  | 'pantalla';

/** Acciones reales que hacen avanzar un paso (las avisa el código que ya existe). */
export type TutorialEvent =
  'form-opened' | 'counter-created' | 'entry-added' | 'entry-removed' | 'selection-opened';

export type StepId =
  | 'welcome'
  | 'intro'
  | 'create'
  | 'name'
  | 'submit'
  | 'add'
  | 'remove'
  | 'hold'
  | 'tools'
  | 'stats-tab'
  | 'stats'
  | 'social-tab'
  | 'social'
  | 'streak'
  | 'done';

/** Pantallas en las que se enseña algo. */
export type TutorialScreen = '/' | '/contadores/nuevo' | '/estadisticas' | '/social';

export type Step = {
  id: StepId;
  title: string;
  /** Solo en la bienvenida: la frase destacada bajo el título. */
  subtitle?: string;
  text: string;
  /**
   * Cómo se ve: 'welcome' y 'finish' a pantalla completa (al empezar y al acabar), 'banner' un
   * rótulo en el centro con todo lo demás apagado (se pasa solo) y 'spotlight' (por defecto)
   * apaga todo menos `target` y explica con un bocadillo.
   */
  kind?: 'welcome' | 'banner' | 'spotlight' | 'finish';
  /** Pantalla en la que se enseña. Si no lo dice, la principal. */
  screen?: TutorialScreen;
  /** Texto del botón de los pasos a pantalla completa. */
  button?: string;
  /**
   * A la pantalla llega el propio usuario (p. ej. al tocar el +): el tutorial no navega. Si en
   * vez de eso vuelve atrás, el tutorial vuelve a `fallback`.
   */
  userNavigates?: boolean;
  fallback?: StepId;
  target?: TargetId;
  /** Paso de acción: no hay «Siguiente», se avanza al hacer esto (y solo se toca el hueco). */
  action?: TutorialEvent;
  /** Paso de pestaña: se avanza al llegar a esta pantalla (tocando la pestaña iluminada). */
  advanceOnScreen?: TutorialScreen;
  /** Se pasa solo al siguiente tras este tiempo (sin botones). */
  autoAdvanceMs?: number;
};

/** Nombre fijo del contador que se crea en el tutorial (no se puede cambiar). */
export const TUTORIAL_COUNTER_NAME = 'Mi primer contador';

const ALL_STEPS: Step[] = [
  {
    id: 'welcome',
    kind: 'welcome',
    title: 'Te damos la bienvenida a Cuéntalo',
    subtitle: 'Tu base de estadísticas vitales',
    text: 'Registra lo que haces, compártelo con tus amigos y disfruta de tus datos.',
    button: 'Seguir',
  },
  {
    id: 'intro',
    kind: 'banner',
    title: 'Esto es Cuéntalo',
    text: '',
    autoAdvanceMs: 2400,
  },
  {
    id: 'create',
    title: 'Crea tu primer contador',
    text: 'Toca el + para empezar.',
    target: 'nuevo-contador',
    action: 'form-opened',
  },
  {
    id: 'name',
    screen: '/contadores/nuevo',
    userNavigates: true,
    fallback: 'create',
    title: 'Ponle nombre',
    text: `Aquí escribes qué quieres contar. Para empezar, lo llamaremos «${TUTORIAL_COUNTER_NAME}».`,
    target: 'nombre',
  },
  {
    id: 'submit',
    screen: '/contadores/nuevo',
    userNavigates: true,
    fallback: 'create',
    title: 'Listo para crearlo',
    text: 'Toca «Crear contador».',
    target: 'crear-contador',
    action: 'counter-created',
  },
  {
    id: 'add',
    title: 'Suma con un toque',
    text: 'Cada toque queda guardado en tu historial. Pruébalo.',
    target: 'sumar',
    action: 'entry-added',
  },
  {
    id: 'remove',
    title: '¿Te has pasado? Resta',
    text: 'El −1 corrige el último toque. Pruébalo.',
    target: 'restar',
    action: 'entry-removed',
  },
  {
    id: 'hold',
    title: 'Mantén pulsado el contador',
    text: 'Así aparecen más herramientas.',
    target: 'tarjeta',
    action: 'selection-opened',
  },
  {
    id: 'tools',
    title: 'Tus herramientas',
    text: 'Borrar, añadir a una carpeta, ocultar, editar o fusionar con otros. Y arrastrando, cambias el orden.',
    target: 'herramientas',
  },
  {
    id: 'stats-tab',
    title: 'Estadísticas',
    text: 'Toca aquí para ver tu evolución.',
    target: 'tab-estadisticas',
    advanceOnScreen: '/estadisticas',
  },
  {
    id: 'stats',
    screen: '/estadisticas',
    title: 'Tu evolución',
    text: 'Por semana, mes, año o desde siempre, en líneas o en barras. Toca la gráfica para ampliarla.',
    target: 'pantalla',
  },
  {
    id: 'social-tab',
    screen: '/estadisticas',
    title: 'Social',
    text: 'Toca aquí para ver a tus amigos y tus grupos.',
    target: 'tab-social',
    advanceOnScreen: '/social',
  },
  {
    id: 'social',
    screen: '/social',
    title: 'Juntos cuenta más',
    text: 'Añade amigos, crea grupos o únete con un código y competid en la clasificación.',
    target: 'pantalla',
  },
  {
    id: 'streak',
    screen: '/estadisticas',
    title: 'Tu racha 🔥',
    text: 'Cuenta los días seguidos en los que apuntas algo. Si un día no registras nada, vuelve a 0.',
    target: 'racha',
  },
  {
    id: 'done',
    kind: 'finish',
    title: 'Todo listo',
    text: 'Empieza a dejar huella de tu vida',
  },
];

/** Pasos del tutorial: siempre los mismos (también se crea un contador aunque ya haya). */
export function buildSteps(): Step[] {
  return ALL_STEPS;
}

/** Índice del paso siguiente al pulsar «Siguiente» (null si era el último: se termina). */
export function nextIndex(steps: Step[], index: number): number | null {
  return index + 1 < steps.length ? index + 1 : null;
}

/** ¿Hace avanzar este evento el paso actual? Solo si es justo la acción que pide. */
export function advancesOn(step: Step | undefined, event: TutorialEvent): boolean {
  return step?.action === event;
}

/** ¿Se pasa al siguiente al llegar a esta pantalla? (pasos de pestaña) */
export function advancesOnScreen(step: Step | undefined, pathname: string): boolean {
  return step?.advanceOnScreen !== undefined && step.advanceOnScreen === pathname;
}

/** Cómo se dibuja un paso (spotlight si no dice otra cosa). */
export function stepKind(step: Step): NonNullable<Step['kind']> {
  return step.kind ?? 'spotlight';
}

/** Pantalla en la que se enseña el paso. */
export function stepScreen(step: Step): TutorialScreen {
  return step.screen ?? '/';
}

/** ¿Se puede tocar lo iluminado? En los pasos de acción y de pestaña, sí (es la tarea). */
export function letsTouchTarget(step: Step): boolean {
  return Boolean(step.action || step.advanceOnScreen);
}

/** ¿Lleva «Siguiente»? Los pasos que solo enseñan algo (o si el elemento no aparece). */
export function showsNext(step: Step, targetMissing: boolean): boolean {
  return targetMissing || !letsTouchTarget(step);
}

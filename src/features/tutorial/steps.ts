// Pasos del tutorial de bienvenida y cómo se avanza. Funciones puras para poder testearlas.

/** Elementos de la app que el tutorial puede iluminar (ver TutorialTarget). */
export type TargetId =
  'nuevo-contador' | 'sumar' | 'restar' | 'tarjeta' | 'racha' | 'tab-estadisticas' | 'tab-social';

/** Acciones reales que hacen avanzar un paso (las avisa el código que ya existe). */
export type TutorialEvent = 'counter-created' | 'entry-added' | 'entry-removed';

export type StepId =
  'welcome' | 'intro' | 'create' | 'add' | 'remove' | 'tips' | 'stats' | 'social' | 'streak';

/** Pestaña en la que se enseña el paso (el tutorial va a ella al llegar al paso). */
export type TutorialScreen = '/' | '/estadisticas' | '/social';

export type Step = {
  id: StepId;
  title: string;
  /** Solo en la bienvenida: la frase destacada bajo el título. */
  subtitle?: string;
  text: string;
  /**
   * Cómo se ve: 'welcome' a pantalla completa, 'banner' un aviso sobre la app sin oscurecer
   * (se pasa solo), 'spotlight' (por defecto) oscurece e ilumina `target`, y 'tour' deja ver la
   * pestaña entera e ilumina solo su botón.
   */
  kind?: 'welcome' | 'banner' | 'spotlight' | 'tour';
  screen?: TutorialScreen;
  target?: TargetId;
  /** Paso de acción: no hay «Siguiente», se avanza al hacer esto (y solo se toca el hueco). */
  action?: TutorialEvent;
  /** Se pasa solo al siguiente tras este tiempo (sin botones). */
  autoAdvanceMs?: number;
};

const ALL_STEPS: Step[] = [
  {
    id: 'welcome',
    kind: 'welcome',
    title: 'Te damos la bienvenida a Cuéntalo',
    subtitle: 'Tu base de estadísticas vitales',
    text: 'Registra lo que haces, compártelo con tus amigos y disfruta de tus datos.',
  },
  {
    id: 'intro',
    kind: 'banner',
    screen: '/',
    title: 'Esto es Cuéntalo',
    text: '',
    autoAdvanceMs: 2000,
  },
  {
    id: 'create',
    screen: '/',
    title: 'Empecemos creando tu primer contador',
    text: 'Toca el + para crearlo.',
    target: 'nuevo-contador',
    action: 'counter-created',
  },
  {
    id: 'add',
    screen: '/',
    title: 'Suma con un toque',
    text: 'Cada toque se guarda en tu historial. ¡Pruébalo!',
    target: 'sumar',
    action: 'entry-added',
  },
  {
    id: 'remove',
    screen: '/',
    title: '¿Te has pasado? Resta 1',
    text: 'El −1 corrige el último toque. Pruébalo.',
    target: 'restar',
    action: 'entry-removed',
  },
  {
    id: 'tips',
    screen: '/',
    title: 'Tu tarjeta',
    text: 'Tócala para ver el historial y las gráficas. Mantén pulsado el primer botón para sumar otra cantidad.',
    target: 'tarjeta',
  },
  {
    id: 'stats',
    kind: 'tour',
    screen: '/estadisticas',
    title: 'Estadísticas',
    text: 'Aquí ves tu evolución por semana, mes o año, en líneas o barras.',
    target: 'tab-estadisticas',
  },
  {
    id: 'social',
    kind: 'tour',
    screen: '/social',
    title: 'Amigos y grupos',
    text: 'Añade amigos, crea grupos o únete con un código y competid en la clasificación.',
    target: 'tab-social',
  },
  {
    id: 'streak',
    screen: '/',
    title: 'Tus estadísticas son más potentes si registras cada día 🔥',
    text: 'Tu racha cuenta los días seguidos en los que apuntas algo. Si un día no registras nada, vuelve a 0. Puedes repetir el tutorial en Configuración.',
    target: 'racha',
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

/** Cómo se dibuja un paso (spotlight si no dice otra cosa). */
export function stepKind(step: Step): NonNullable<Step['kind']> {
  return step.kind ?? 'spotlight';
}

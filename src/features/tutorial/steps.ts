// Pasos del tutorial de bienvenida y cómo se avanza. Funciones puras para poder testearlas.

/** Elementos de la app que el tutorial puede iluminar (ver TutorialTarget). */
export type TargetId =
  | 'nuevo-contador'
  | 'ideas'
  | 'crear-contador'
  | 'sumar'
  | 'restar'
  | 'tarjeta'
  | 'racha'
  | 'tab-estadisticas'
  | 'tab-social';

/** Acciones reales que hacen avanzar un paso (las avisa el código que ya existe). */
export type TutorialEvent =
  'form-opened' | 'idea-chosen' | 'counter-created' | 'entry-added' | 'entry-removed';

export type StepId =
  | 'welcome'
  | 'intro'
  | 'create'
  | 'pick-idea'
  | 'submit'
  | 'add'
  | 'remove'
  | 'stats'
  | 'social'
  | 'streak'
  | 'done';

/** Pantalla en la que se enseña el paso (el tutorial va a ella al llegar, salvo `userNavigates`). */
export type TutorialScreen = '/' | '/contadores/nuevo';

export type Step = {
  id: StepId;
  title: string;
  /** Solo en la bienvenida: la frase destacada bajo el título. */
  subtitle?: string;
  text: string;
  /**
   * Cómo se ve: 'welcome' y 'finish' a pantalla completa (al empezar y al acabar), 'banner' un
   * aviso sobre la app sin oscurecer (se pasa solo) y 'spotlight' (por defecto) oscurece todo
   * menos `target`.
   */
  kind?: 'welcome' | 'banner' | 'spotlight' | 'finish';
  /** Pantalla en la que se enseña. Si no lo dice, la principal. */
  screen?: TutorialScreen;
  /** Texto del botón de los pasos a pantalla completa. */
  button?: string;
  /**
   * El paso empieza en otra pantalla a la que llega el propio usuario (p. ej. al tocar el +):
   * el tutorial no navega a `screen`.
   */
  userNavigates?: boolean;
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
    button: 'Siguiente',
  },
  {
    id: 'intro',
    kind: 'banner',
    title: 'Esto es Cuéntalo',
    text: '',
    autoAdvanceMs: 2000,
  },
  {
    id: 'create',
    title: 'Empecemos creando tu primer contador',
    text: 'Toca el + para crearlo.',
    target: 'nuevo-contador',
    action: 'form-opened',
  },
  {
    id: 'pick-idea',
    screen: '/contadores/nuevo',
    userNavigates: true,
    title: 'Elige qué quieres contar',
    text: 'Toca una de estas ideas. Luego podrás crear los tuyos como quieras.',
    target: 'ideas',
    action: 'idea-chosen',
  },
  {
    id: 'submit',
    screen: '/contadores/nuevo',
    userNavigates: true,
    title: '¡Así de fácil!',
    text: 'Toca «Crear contador».',
    target: 'crear-contador',
    action: 'counter-created',
  },
  {
    id: 'add',
    title: 'Suma con un toque',
    text: 'Cada toque se guarda en tu historial. ¡Pruébalo!',
    target: 'sumar',
    action: 'entry-added',
  },
  {
    id: 'remove',
    title: '¿Te has pasado? Resta 1',
    text: 'El −1 corrige el último toque. Pruébalo.',
    target: 'restar',
    action: 'entry-removed',
  },
  {
    id: 'stats',
    title: 'Estadísticas',
    text: 'En esta pestaña verás tu evolución por semana, mes o año, en líneas o barras.',
    target: 'tab-estadisticas',
  },
  {
    id: 'social',
    title: 'Amigos y grupos',
    text: 'Aquí añades amigos, creas grupos o te unes con un código y competís en la clasificación.',
    target: 'tab-social',
  },
  {
    id: 'streak',
    title: 'Tus estadísticas son más potentes si registras cada día 🔥',
    text: 'Tu racha cuenta los días seguidos en los que apuntas algo. Si un día no registras nada, vuelve a 0.',
    target: 'racha',
  },
  {
    id: 'done',
    kind: 'finish',
    title: 'Todo listo',
    text: '',
    button: 'Empieza a dejar huella de tu vida',
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

/** Cómo se dibuja un paso (spotlight si no dice otra cosa). */
export function stepKind(step: Step): NonNullable<Step['kind']> {
  return step.kind ?? 'spotlight';
}

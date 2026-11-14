import { DEFAULT_SHAPE, type HoleShape } from './layout';

// Guion del tutorial de bienvenida: siempre los mismos pasos, en el mismo orden, sobre una
// demostración fija de la app (Demo.tsx). No toca la app de verdad ni la base de datos: lo que
// se ve en cada paso sale solo del paso. Funciones puras para poder testearlas.

/** Pantallas de la demostración. */
export type Scene = 'home-empty' | 'form' | 'home' | 'stats' | 'social';

export const SCENES: Scene[] = ['home-empty', 'form', 'home', 'stats', 'social'];

/** Elementos de la demostración que se pueden iluminar (ver DemoTarget). */
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
  | 'pantalla-estadisticas'
  | 'pantalla-social';

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
  /** Pantalla de la demostración en la que ocurre. */
  scene: Scene;
  /** Texto del botón de los pasos a pantalla completa. */
  button?: string;
  target?: TargetId;
  /**
   * Lo que hay que hacer con lo iluminado para seguir: tocarlo o mantenerlo pulsado. Sin
   * acción, se sigue con «Siguiente».
   */
  action?: 'tap' | 'hold';
  /** Se pasa solo al siguiente tras este tiempo (sin botones). */
  autoAdvanceMs?: number;
};

/** Nombre del contador de la demostración. */
export const TUTORIAL_COUNTER_NAME = 'Mi primer contador';

const ALL_STEPS: Step[] = [
  {
    id: 'welcome',
    kind: 'welcome',
    scene: 'home-empty',
    title: 'Te damos la bienvenida a Cuéntalo',
    subtitle: 'Tu base de estadísticas vitales',
    text: 'Registra lo que haces, compártelo con tus amigos y disfruta de tus datos.',
    button: 'Seguir',
  },
  {
    id: 'intro',
    kind: 'banner',
    scene: 'home-empty',
    title: 'Esto es Cuéntalo',
    text: '',
    autoAdvanceMs: 2400,
  },
  {
    id: 'create',
    scene: 'home-empty',
    title: 'Crea tu primer contador',
    text: 'Toca el + para empezar.',
    target: 'nuevo-contador',
    action: 'tap',
  },
  {
    id: 'name',
    scene: 'form',
    title: 'Ponle nombre',
    text: `Aquí escribes qué quieres contar. Para empezar, lo llamaremos «${TUTORIAL_COUNTER_NAME}».`,
    target: 'nombre',
  },
  {
    id: 'submit',
    scene: 'form',
    title: 'Listo para crearlo',
    text: 'Toca «Crear contador».',
    target: 'crear-contador',
    action: 'tap',
  },
  {
    id: 'add',
    scene: 'home',
    title: 'Suma con un toque',
    text: 'Cada toque queda guardado en tu historial. Pruébalo.',
    target: 'sumar',
    action: 'tap',
  },
  {
    id: 'remove',
    scene: 'home',
    title: '¿Te has pasado? Resta',
    text: 'El −1 corrige el último toque. Pruébalo.',
    target: 'restar',
    action: 'tap',
  },
  {
    id: 'hold',
    scene: 'home',
    title: 'Mantén pulsado el contador',
    text: 'Así aparecen más herramientas.',
    target: 'tarjeta',
    action: 'hold',
  },
  {
    id: 'tools',
    scene: 'home',
    title: 'Tus herramientas',
    text: 'Borrar, añadir a una carpeta, ocultar, editar o fusionar con otros. Y arrastrando, cambias el orden.',
    target: 'herramientas',
  },
  {
    id: 'stats-tab',
    scene: 'home',
    title: 'Estadísticas',
    text: 'Toca aquí para ver tu evolución.',
    target: 'tab-estadisticas',
    action: 'tap',
  },
  {
    id: 'stats',
    scene: 'stats',
    title: 'Tu evolución',
    text: 'Por semana, mes, año o desde siempre, en líneas o en barras. Toca la gráfica para ampliarla.',
    target: 'pantalla-estadisticas',
  },
  {
    id: 'social-tab',
    scene: 'stats',
    title: 'Social',
    text: 'Toca aquí para ver a tus amigos y tus grupos.',
    target: 'tab-social',
    action: 'tap',
  },
  {
    id: 'social',
    scene: 'social',
    title: 'Juntos cuenta más',
    text: 'Añade amigos, crea grupos o únete con un código y competid en la clasificación.',
    target: 'pantalla-social',
  },
  {
    id: 'streak',
    scene: 'stats',
    title: 'Tu racha 🔥',
    text: 'Cuenta los días seguidos en los que apuntas algo. Cuéntalo es más potente cuantos más días registras: no la dejes caer.',
    target: 'racha',
  },
  {
    id: 'done',
    kind: 'finish',
    scene: 'stats',
    title: 'Todo listo',
    text: 'Empieza a dejar huella de tu vida',
  },
];

/** Pasos del tutorial: siempre los mismos. */
export function buildSteps(): Step[] {
  return ALL_STEPS;
}

/** Índice del paso siguiente (null si era el último: se termina). */
export function nextIndex(steps: Step[], index: number): number | null {
  return index + 1 < steps.length ? index + 1 : null;
}

/** Cómo se dibuja un paso (spotlight si no dice otra cosa). */
export function stepKind(step: Step): NonNullable<Step['kind']> {
  return step.kind ?? 'spotlight';
}

/** ¿Se puede tocar lo iluminado? Solo en los pasos con una acción (es la tarea). */
export function letsTouchTarget(step: Step): boolean {
  return step.action !== undefined;
}

/** ¿Lleva «Siguiente»? Los pasos que solo enseñan algo (o si el elemento no aparece). */
export function showsNext(step: Step, targetMissing: boolean): boolean {
  return targetMissing || !letsTouchTarget(step);
}

/** ¿Hace este gesto sobre este elemento lo que pide el paso? Cualquier otro no hace nada. */
export function completesStep(
  step: Step | undefined,
  target: TargetId,
  gesture: 'tap' | 'hold',
): boolean {
  return step !== undefined && step.target === target && step.action === gesture;
}

/**
 * Forma del hueco de cada elemento, para que se ajuste a lo que ilumina: las pestañas, los
 * botones redondos y las insignias en píldora; la tarjeta y los botones con su propio radio.
 */
const SHAPES: Partial<Record<TargetId, HoleShape>> = {
  'nuevo-contador': { padding: 6, radius: 0, pill: true },
  'crear-contador': { padding: 6, radius: 0, pill: true },
  'tab-estadisticas': { padding: 0, radius: 0, pill: true },
  'tab-social': { padding: 0, radius: 0, pill: true },
  racha: { padding: 6, radius: 0, pill: true },
  herramientas: { padding: 8, radius: 0, pill: true },
  sumar: { padding: 5, radius: 15 },
  restar: { padding: 5, radius: 15 },
  tarjeta: { padding: 6, radius: 30 },
  nombre: { padding: 8, radius: 20 },
  'pantalla-estadisticas': { padding: -8, radius: 24 },
  'pantalla-social': { padding: -8, radius: 24 },
};

export function targetShape(target: TargetId | undefined): HoleShape {
  return (target && SHAPES[target]) || DEFAULT_SHAPE;
}

/** ¿Ilumina una pantalla entera (no un elemento)? */
export function isWholeScreen(target: TargetId | undefined): boolean {
  return target === 'pantalla-estadisticas' || target === 'pantalla-social';
}

/**
 * ¿Se cierra el hueco (como un iris) al pasar de un paso a otro? Sí si cambia la pantalla o si
 * lo siguiente no ilumina nada (rótulo, pantallas completas). Entre dos elementos de la misma
 * pantalla, no: el foco se desliza directamente de uno a otro.
 */
export function closesBetween(prev: Step | null, next: Step): boolean {
  if (!prev || stepKind(prev) !== 'spotlight') return false;
  if (stepKind(next) !== 'spotlight') return true;
  return prev.scene !== next.scene;
}

/** Lo que enseña la demostración en cada paso (siempre lo mismo para el mismo paso). */
export type DemoState = {
  /** Total del contador de la demostración. */
  total: number;
  /** Modo selección (tras mantener pulsado el contador). */
  selecting: boolean;
};

export function demoState(id: StepId): DemoState {
  return { total: id === 'remove' ? 1 : 0, selecting: id === 'tools' };
}

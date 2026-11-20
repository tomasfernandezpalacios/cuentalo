import { MAX_LEVEL } from './model';

// Rangos de vida (petición del usuario: que el camino transmita avance en la vida, no en un
// juego). Los 100 niveles son 20 capítulos de 5 rangos cada uno (I a V), de la semilla que empieza
// a registrar su vida al infinito. Cada capítulo tiene su emblema (cada vez más elaborado, ver
// `RankEmblem`), su color y una frase que dice qué significa haber llegado ahí. Pasar a un
// capítulo nuevo da recompensas extra (`tierBonus`).

export type Tier = {
  /** Capítulo (1–20). */
  chapter: number;
  name: string;
  /** Lo que significa llegar aquí, en una frase. */
  motto: string;
  /** Icono de Ionicons del centro del emblema. */
  icon: string;
  /** Color del emblema. */
  color: string;
  /** Color del texto y el icono sobre el emblema (contraste suficiente). */
  ink: string;
};

const DARK_INK = '#1A1714';
const LIGHT_INK = '#FFFFFF';

/** Luminancia relativa de un color #RRGGBB (WCAG). */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Tinta que mejor se lee sobre ese color: casi negro o blanco (el de más contraste). */
export function inkFor(color: string): string {
  const l = luminance(color);
  const withDark = (l + 0.05) / (luminance(DARK_INK) + 0.05);
  const withLight = 1.05 / (l + 0.05);
  return withDark >= withLight ? DARK_INK : LIGHT_INK;
}

const BASE: Omit<Tier, 'chapter' | 'ink'>[] = [
  {
    name: 'Semilla',
    motto: 'Todo gran cambio empieza por un primer registro.',
    icon: 'leaf',
    color: '#8C9A6B',
  },
  {
    name: 'Brote',
    motto: 'Lo que cuidas cada día empieza a crecer.',
    icon: 'flower',
    color: '#6FA06A',
  },
  {
    name: 'Caminante',
    motto: 'Ya no das pasos sueltos: tienes un camino.',
    icon: 'walk',
    color: '#B88A5A',
  },
  {
    name: 'Explorador',
    motto: 'Te conoces mejor: tus números cuentan tu historia.',
    icon: 'compass',
    color: '#5E8FA8',
  },
  {
    name: 'Constante',
    motto: 'La constancia ya no es un esfuerzo: es quien eres.',
    icon: 'flame',
    color: '#D2692F',
  },
  {
    name: 'Artesano',
    motto: 'Das forma a tu vida con tus propias manos.',
    icon: 'hammer',
    color: '#A0785A',
  },
  {
    name: 'Forjador',
    motto: 'Tus hábitos ya son de acero: los has forjado tú.',
    icon: 'construct',
    color: '#8A8F98',
  },
  {
    name: 'Guardián',
    motto: 'Proteges lo que te importa, día tras día.',
    icon: 'shield-checkmark',
    color: '#3F8F86',
  },
  {
    name: 'Guía',
    motto: 'Tu ejemplo empieza a inspirar a los demás.',
    icon: 'map',
    color: '#4F7FA8',
  },
  {
    name: 'Sabio',
    motto: 'Has aprendido de cada día que has contado.',
    icon: 'book',
    color: '#7E6BA8',
  },
  {
    name: 'Maestro',
    motto: 'Dominas el arte de construir tus días.',
    icon: 'school',
    color: '#9A5BA8',
  },
  {
    name: 'Visionario',
    motto: 'Ves más lejos porque has llegado lejos.',
    icon: 'eye',
    color: '#5B6BD6',
  },
  {
    name: 'Campeón',
    motto: 'Has ganado la carrera más larga: la de la constancia.',
    icon: 'medal',
    color: '#C08A2E',
  },
  {
    name: 'Héroe',
    motto: 'Lo que haces cada día ya cambia tu historia.',
    icon: 'ribbon',
    color: '#C0503A',
  },
  {
    name: 'Titán',
    motto: 'Nada te frena: tu disciplina es enorme.',
    icon: 'barbell',
    color: '#6E7F96',
  },
  {
    name: 'Leyenda',
    motto: 'Pocos llegan aquí. Tu historia ya es leyenda.',
    icon: 'star',
    color: '#E9C46A',
  },
  {
    name: 'Mito',
    motto: 'Ya no se cuenta tu historia: se recuerda.',
    icon: 'sparkles',
    color: '#C9A0E0',
  },
  {
    name: 'Eterno',
    motto: 'Tus días contados dejan huella para siempre.',
    icon: 'hourglass',
    color: '#F0E3B0',
  },
  {
    name: 'Celestial',
    motto: 'Has subido tan alto que tocas las estrellas.',
    icon: 'planet',
    color: '#8FD3F0',
  },
  {
    name: 'Infinito',
    motto: 'No hay final. Solo tú, día tras día.',
    icon: 'infinite',
    color: '#F2C230',
  },
];

export const TIERS: Tier[] = BASE.map((tier, i) => ({
  ...tier,
  chapter: i + 1,
  ink: inkFor(tier.color),
}));

/** Rangos por capítulo. */
export const RANKS_PER_TIER = MAX_LEVEL / TIERS.length;

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export type Rank = {
  tier: Tier;
  /** Rango dentro del capítulo (1–5). */
  step: number;
  /** «Caminante III». */
  name: string;
  /** Es el primer nivel de un capítulo (se estrena rango). */
  firstOfTier: boolean;
};

/** Rango del nivel `level` (1–100). */
export function rankOf(level: number): Rank {
  const clamped = Math.min(MAX_LEVEL, Math.max(1, level));
  const index = Math.floor((clamped - 1) / RANKS_PER_TIER);
  const tier = TIERS[index] ?? (TIERS[TIERS.length - 1] as Tier);
  const step = ((clamped - 1) % RANKS_PER_TIER) + 1;
  return { tier, step, name: `${tier.name} ${ROMAN[step - 1] ?? step}`, firstOfTier: step === 1 };
}

/** Niveles de un capítulo. */
export function tierLevels(tier: Tier): number[] {
  const first = (tier.chapter - 1) * RANKS_PER_TIER + 1;
  return Array.from({ length: RANKS_PER_TIER }, (_, i) => first + i);
}

/**
 * Recompensa extra por estrenar capítulo (además de la del nivel): monedas que crecen con el
 * capítulo y un protector de racha.
 */
export function tierBonus(chapter: number): { coins: number; shields: number } {
  return { coins: 100 + 50 * (chapter - 2), shields: 1 };
}

/** Capítulos que se ven en el camino: los ya alcanzados y dos más (el final no se enseña). */
export const CHAPTERS_AHEAD = 2;

/**
 * Lo elaborado que es el emblema del capítulo (1–5): de un círculo sencillo a un emblema con
 * alas y corona. Cambia cada 4 capítulos.
 */
export function emblemStage(chapter: number): number {
  return Math.min(5, Math.ceil(chapter / 4));
}

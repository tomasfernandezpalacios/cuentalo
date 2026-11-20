// El «mundo» de los bots con vida: cinco amigos (las cuentas prueba1 … prueba5) que usan
// Cuéntalo desde el 14 de septiembre de 2026, con sus contadores, tres grupos y una forma de
// apuntar cada uno. Lo usan `sembrar.mjs` (la historia de golpe) y `dia.mjs` (cada día).
//
// Cada plan dice qué apunta una persona en un contador un día concreto: una lista de
// [cantidad, hora] (hora decimal en la hora de Madrid; 21.5 = 21:30).

export const START = '2026-09-14';
export const TIME_ZONE = 'Europe/Madrid';
export const EMAIL_DOMAIN = 'cuentalo.test';
/** Tu cuenta: los bots te mandan amistad y, si aceptas, te invitan a sus grupos. */
export const HUMAN = 'tomasito1889';

export const PEOPLE = {
  prueba1: { name: 'Lucía Martín', emoji: '🌿', start: 0 },
  prueba2: { name: 'Marcos Ruiz', emoji: '💪', start: 0 },
  prueba3: { name: 'Sofía Navarro', emoji: '🎧', start: 3 },
  prueba4: { name: 'Daniel Gómez', emoji: '📖', start: 15 },
  prueba5: { name: 'Carla Ortega', emoji: '🔥', start: 8 },
};

/** Amistades: [quien la envía, quien la recibe, aceptada]. */
export const FRIENDSHIPS = [
  ['prueba1', 'prueba2', true],
  ['prueba1', 'prueba3', true],
  ['prueba1', 'prueba4', true],
  ['prueba1', 'prueba5', true],
  ['prueba2', 'prueba3', true],
  ['prueba2', 'prueba4', true],
  ['prueba2', 'prueba5', true],
  ['prueba3', 'prueba4', true],
  ['prueba5', 'prueba3', true],
  ['prueba5', 'prueba4', false], // Daniel aún no le ha contestado a Carla
];

export const GROUPS = [
  {
    key: 'gimnasio',
    name: 'Gimnasio',
    emoji: '🏋️',
    owner: 'prueba2',
    members: ['prueba1', 'prueba3', 'prueba5'],
    inviteHuman: true,
  },
  {
    key: 'piso',
    name: 'Piso Lavapiés',
    emoji: '🏠',
    owner: 'prueba3',
    members: ['prueba2', 'prueba4'],
  },
  {
    key: 'lectura',
    name: 'Club de lectura',
    emoji: '📚',
    owner: 'prueba1',
    members: ['prueba3', 'prueba4', 'prueba5'],
    inviteHuman: true,
  },
];

const n = (k, f) => Array.from({ length: k }, f);
const one = (amount, hour) => [[amount, hour]];

export const COUNTERS = [
  // --- Individuales ---
  {
    key: 'agua',
    owner: 'prueba1',
    name: 'Vasos de agua',
    emoji: '💧',
    unit: 'vasos',
    plan: { prueba1: (r) => n(r.int(4, 8), () => [1, r.hour(8, 22)]) },
  },
  {
    key: 'meditacion',
    owner: 'prueba1',
    name: 'Meditación',
    emoji: '🧘',
    unit: 'min',
    streak: true,
    plan: {
      prueba1: (r, c) =>
        [22, 41].includes(c.day) ? [] : one(r.pick([10, 10, 15, 15, 20]), r.hour(7, 8.5)),
    },
  },
  {
    key: 'paginas',
    owner: 'prueba1',
    name: 'Páginas leídas',
    emoji: '📖',
    unit: 'páginas',
    plan: { prueba1: (r) => (r.p(0.75) ? one(r.int(10, 45), r.hour(22, 23.8)) : []) },
  },
  {
    key: 'cafes',
    owner: 'prueba2',
    name: 'Cafés',
    emoji: '☕',
    unit: 'cafés',
    plan: {
      prueba2: (r, c) =>
        n(c.weekend ? r.int(0, 2) : r.int(2, 4), () => [1, r.pick([8, 8.5, 11, 16.5, 17])]),
    },
  },
  {
    key: 'dulces',
    owner: 'prueba2',
    name: 'Días sin dulces',
    emoji: '🍩',
    unit: null,
    streak: true,
    plan: { prueba2: (r, c) => ([30, 47].includes(c.day) ? [] : one(1, r.hour(21, 23))) },
  },
  {
    key: 'series',
    owner: 'prueba3',
    name: 'Capítulos de series',
    emoji: '📺',
    unit: 'capítulos',
    plan: {
      prueba3: (r, c) => n(r.int(0, c.weekend ? 4 : 2), () => [1, r.hour(21, 24)]),
    },
  },
  {
    key: 'km',
    owner: 'prueba3',
    name: 'Kilómetros corridos',
    emoji: '🏃',
    unit: 'km',
    plan: {
      prueba3: (r, c) =>
        [2, 4, 0].includes(c.weekday) && r.p(0.8)
          ? one(r.pick([5, 5.5, 6, 6.5, 7, 8, 10]), r.hour(7, 9))
          : [],
    },
  },
  {
    key: 'conciertos',
    owner: 'prueba3',
    name: 'Conciertos',
    emoji: '🎸',
    unit: null,
    plan: { prueba3: (r, c) => (c.weekday === 5 && r.p(0.25) ? one(1, 23) : []) },
  },
  {
    key: 'libros',
    owner: 'prueba4',
    name: 'Libros',
    emoji: '📕',
    unit: 'libros',
    plan: { prueba4: (r) => (r.p(0.06) ? one(1, r.hour(22, 23.5)) : []) },
  },
  {
    key: 'paseos',
    owner: 'prueba4',
    name: 'Paseos',
    emoji: '🚶',
    unit: null,
    plan: { prueba4: (r, c) => (r.p(c.weekend ? 0.7 : 0.35) ? one(1, r.hour(18, 20)) : []) },
  },
  {
    key: 'estudio',
    owner: 'prueba5',
    name: 'Horas de estudio',
    emoji: '🎓',
    unit: 'h',
    plan: {
      prueba5: (r, c) =>
        c.weekend && r.p(0.6) ? [] : one(r.pick([1, 1.5, 2, 2.5, 3, 4]), r.hour(19, 22)),
    },
  },

  // --- Gimnasio ---
  {
    key: 'entrenos',
    group: 'gimnasio',
    owner: 'prueba2',
    name: 'Entrenos',
    emoji: '🏋️',
    unit: 'sesiones',
    plan: {
      prueba2: (r, c) => (!c.weekend && r.p(0.85) ? one(1, r.hour(18, 21)) : []),
      prueba5: (r, c) => (c.weekday !== 0 && r.p(0.85) ? one(1, r.hour(7, 9)) : []),
      prueba1: (r) => (r.p(0.4) ? one(1, r.hour(19, 21)) : []),
      prueba3: (r) => (r.p(0.25) ? one(1, r.hour(12, 14)) : []),
    },
  },
  {
    key: 'flexiones',
    group: 'gimnasio',
    owner: 'prueba5',
    name: 'Flexiones',
    emoji: '💪',
    unit: null,
    streak: true,
    plan: {
      prueba5: (r, c) =>
        c.day === 20 ? [] : n(r.int(2, 4), () => [r.pick([15, 20, 25, 30]), r.hour(7, 22)]),
      prueba2: (r) =>
        r.p(0.5) ? n(r.int(1, 2), () => [r.pick([20, 25, 30]), r.hour(18, 21)]) : [],
      prueba1: (r) => (r.p(0.2) ? one(r.pick([10, 15]), r.hour(19, 21)) : []),
      prueba3: (r) => (r.p(0.1) ? one(r.pick([10, 20]), r.hour(12, 14)) : []),
    },
  },

  // --- Piso Lavapiés ---
  {
    key: 'cervezas',
    group: 'piso',
    owner: 'prueba3',
    name: 'Cervezas',
    emoji: '🍺',
    unit: null,
    plan: {
      prueba3: (r, c) =>
        [5, 6].includes(c.weekday) && r.p(0.8) ? n(r.int(1, 4), () => [1, r.hour(20, 24)]) : [],
      prueba2: (r, c) => (c.weekend && r.p(0.6) ? n(r.int(1, 3), () => [1, r.hour(20, 24)]) : []),
      prueba4: (r, c) => (c.weekday === 5 && r.p(0.4) ? one(1, r.hour(21, 23)) : []),
    },
  },
  {
    key: 'friegos',
    group: 'piso',
    owner: 'prueba2',
    name: 'Veces que friego',
    emoji: '🧽',
    unit: null,
    plan: {
      prueba2: (r) => (r.p(0.45) ? one(1, r.hour(15, 16)) : []),
      prueba3: (r) => (r.p(0.3) ? one(1, r.hour(22, 23)) : []),
      prueba4: (r) => (r.p(0.35) ? one(1, r.hour(15, 16)) : []),
    },
  },
  {
    key: 'pizzas',
    group: 'piso',
    owner: 'prueba3',
    common: true,
    name: 'Pizzas pedidas',
    emoji: '🍕',
    unit: 'pizzas',
    plan: {
      prueba3: (r, c) => ([5, 0].includes(c.weekday) && r.p(0.45) ? one(r.int(1, 2), 21.5) : []),
    },
  },

  // --- Club de lectura ---
  {
    key: 'terminados',
    group: 'lectura',
    owner: 'prueba1',
    name: 'Libros terminados',
    emoji: '📚',
    unit: 'libros',
    plan: {
      prueba1: (r) => (r.p(0.09) ? one(1, r.hour(22, 23.5)) : []),
      prueba4: (r) => (r.p(0.07) ? one(1, r.hour(22, 23.5)) : []),
      prueba5: (r) => (r.p(0.05) ? one(1, r.hour(22, 23.5)) : []),
      prueba3: (r) => (r.p(0.03) ? one(1, r.hour(22, 23.5)) : []),
    },
  },
];

/** Carpetas de cada uno (claves de contadores). */
export const FOLDERS = [
  { owner: 'prueba1', name: 'Salud', counters: ['agua', 'meditacion', 'entrenos'] },
  { owner: 'prueba3', name: 'Ocio', counters: ['series', 'conciertos', 'cervezas'] },
];

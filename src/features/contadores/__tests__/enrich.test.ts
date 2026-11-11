import {
  countersFromBundle,
  enrich,
  type Counter,
  type CounterGroup,
  type CounterTotal,
} from '../api';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const ME = 'me';
const OTHER = 'other';

function counter(overrides: Partial<Counter>): Counter {
  return {
    id: 'c1',
    owner_id: ME,
    name: 'Cervezas',
    unit: null,
    emoji: null,
    photo_path: null,
    group_id: null,
    is_common: false,
    hidden_from_friends: false,
    streak_enabled: false,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const totals: CounterTotal[] = [
  {
    counter_id: 'c1',
    total: 10,
    entry_count: 4,
    last_logged_at: '2026-01-02T00:00:00Z',
    my_total: 3,
    my_entry_count: 1,
    my_group_total: 3,
  },
];

const myGroup: CounterGroup = {
  id: 'g1',
  name: 'Amigos',
  ownerId: OTHER,
  emoji: null,
  photoPath: null,
};
const groups = new Map([[myGroup.id, myGroup]]);

describe('enrich', () => {
  it('privado mío: activo y editable, con totales', () => {
    const result = enrich(counter({}), totals, groups, ME);
    expect(result).toMatchObject({ isActive: true, canManage: true, total: 10, myTotal: 3 });
  });

  it('sin registros: totales a 0', () => {
    const result = enrich(counter({ id: 'c2' }), totals, groups, ME);
    expect(result).toMatchObject({ total: 0, entryCount: 0, myTotal: 0, myEntryCount: 0 });
  });

  it('compartido creado por otro en mi grupo: activo pero no editable', () => {
    const result = enrich(counter({ owner_id: 'third', group_id: 'g1' }), totals, groups, ME);
    expect(result).toMatchObject({ isActive: true, canManage: false, group: myGroup });
  });

  it('compartido creado por mí: editable', () => {
    const result = enrich(counter({ group_id: 'g1' }), totals, groups, ME);
    expect(result.canManage).toBe(true);
  });

  it('el owner del grupo no administra los contadores que crearon otros', () => {
    const result = enrich(counter({ owner_id: ME, group_id: 'g1' }), totals, groups, OTHER);
    expect(result.canManage).toBe(false);
  });

  it('común: guarda participantes y enseña mi total si participo', () => {
    const participants = new Map([['c1', [ME, OTHER]]]);
    const common = counter({ group_id: 'g1', is_common: true });
    const result = enrich(common, totals, groups, ME, participants);
    expect(result).toMatchObject({ participantIds: [ME, OTHER], displayTotal: 3 });
  });

  it('común sin participar: enseña lo que lleva cada participante', () => {
    const participants = new Map([['c1', ['a', 'b']]]);
    const common = counter({ group_id: 'g1', is_common: true });
    expect(enrich(common, totals, groups, ME, participants).displayTotal).toBe(5);
  });

  it('no común: ignora participantes', () => {
    const participants = new Map([['c1', [ME]]]);
    expect(enrich(counter({}), totals, groups, ME, participants).participantIds).toEqual([]);
  });

  it('un alias cambia lo que veo pero conserva el nombre compartido', () => {
    const aliases = new Map([['c1', { name: 'Mis cañas', emoji: '🍻' }]]);
    const shared = counter({ group_id: 'g1', emoji: '🍺' });
    const result = enrich(shared, totals, groups, ME, new Map(), aliases);
    expect(result).toMatchObject({
      name: 'Mis cañas',
      emoji: '🍻',
      sharedName: 'Cervezas',
      sharedEmoji: '🍺',
      myGroupTotal: 3,
    });
  });

  it('de un grupo del que salí: no sale en la lista ni se puede editar', () => {
    const result = enrich(counter({ group_id: 'g-left' }), totals, groups, ME);
    expect(result).toMatchObject({ isActive: false, canManage: false, group: null });
  });
});

describe('enrich: formato racha', () => {
  const streaks = new Map([['c1', { current: 4, best: 9, todayDone: true, todayAmount: 1 }]]);
  const args = [new Map(), new Map(), new Set<string>(), new Set<string>(), streaks] as const;

  it('el contador sigue con su total y lleva la racha aparte', () => {
    const result = enrich(counter({ streak_enabled: true }), totals, groups, ME, ...args);
    expect(result.displayTotal).toBe(3);
    expect(result.streak).toEqual({ current: 4, best: 9, todayDone: true, todayAmount: 1 });
  });

  it('sin días buenos la racha es 0 y hoy no está hecha', () => {
    const result = enrich(counter({ id: 'c2', streak_enabled: true }), totals, groups, ME, ...args);
    expect(result.streak).toEqual({ current: 0, best: 0, todayDone: false, todayAmount: 0 });
  });

  it('un contador normal no tiene racha', () => {
    const result = enrich(counter({}), totals, groups, ME, ...args);
    expect(result.streak).toBeNull();
  });
});

describe('enrich: ocultos', () => {
  it('solo cuenta como oculto si está en mis ocultos', () => {
    expect(
      enrich(counter({}), totals, groups, ME, new Map(), new Map(), new Set(['c1'])).hidden,
    ).toBe(true);
    expect(enrich(counter({}), totals, groups, ME).hidden).toBe(false);
  });
});

describe('countersFromBundle (todo en una petición)', () => {
  it('da lo mismo que montar la lista consulta a consulta', () => {
    const shared = counter({ id: 'c2', owner_id: OTHER, group_id: 'g1', is_common: true });
    const bundle = {
      counters: [counter({ streak_enabled: true }), shared],
      totals,
      groups: [{ id: 'g1', name: 'Amigos', owner_id: OTHER, emoji: null, photo_path: null }],
      participants: [
        { counter_id: 'c2', user_id: ME },
        { counter_id: 'c2', user_id: OTHER },
      ],
      aliases: [{ counter_id: 'c1', name: 'Mis cervezas', emoji: '🍺' }],
      links: [],
      hidden: ['c2'],
      removed: [],
      streaks: [
        {
          counter_id: 'c1',
          current_total: 2,
          current_days: 2,
          best_total: 5,
          best_days: 5,
          today_done: true,
          today_amount: 1,
        },
      ],
    };
    const [mine, group] = countersFromBundle(bundle, ME);
    expect(mine).toEqual(
      enrich(
        bundle.counters[0]!,
        totals,
        groups,
        ME,
        new Map(),
        new Map([['c1', { name: 'Mis cervezas', emoji: '🍺' }]]),
        new Set(['c2']),
        new Set(),
        new Map([['c1', { current: 2, best: 5, todayDone: true, todayAmount: 1 }]]),
      ),
    );
    expect(mine?.name).toBe('Mis cervezas');
    expect(mine?.streak).toEqual({ current: 2, best: 5, todayDone: true, todayAmount: 1 });
    expect(group?.participantIds).toEqual([ME, OTHER]);
    expect(group?.hidden).toBe(true);
    expect(group?.group?.name).toBe('Amigos');
  });
});

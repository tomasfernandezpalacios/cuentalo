import { enrich, type Counter, type CounterGroup, type CounterTotal } from '../api';

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
    group_id: null,
    is_common: false,
    streak_enabled: false,
    archived: false,
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

const myGroup: CounterGroup = { id: 'g1', name: 'Amigos', ownerId: OTHER };
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

  it('el owner del grupo puede editar cualquier contador del grupo', () => {
    const result = enrich(counter({ owner_id: ME, group_id: 'g1' }), totals, groups, OTHER);
    expect(result.canManage).toBe(true);
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

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

  it('de un grupo del que salí: no sale en la lista ni se puede editar', () => {
    const result = enrich(counter({ group_id: 'g-left' }), totals, groups, ME);
    expect(result).toMatchObject({ isActive: false, canManage: false, group: null });
  });
});

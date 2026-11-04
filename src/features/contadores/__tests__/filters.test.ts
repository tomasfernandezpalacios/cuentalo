import type { CounterWithTotal } from '../api';
import { activeFilterCount, DEFAULT_FILTERS, filterCounters } from '../filters';
import type { Folder } from '../folders';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const NOW = new Date('2026-11-10T12:00:00Z');

function counter(id: string, groupId: string | null, lastLoggedAt: string | null) {
  return { id, group_id: groupId, lastLoggedAt } as CounterWithTotal;
}

const counters = [
  counter('privado-hoy', null, '2026-11-10T08:00:00Z'),
  counter('privado-viejo', null, '2025-01-01T00:00:00Z'),
  counter('grupo-semana', 'g1', '2026-11-05T00:00:00Z'),
  counter('grupo-nunca', 'g1', null),
  counter('otro-grupo', 'g2', null),
];
const folders: Folder[] = [
  { id: 'f1', name: 'Deporte', counterIds: ['privado-viejo', 'grupo-semana'] },
];

const ids = (list: CounterWithTotal[]) => list.map((c) => c.id);

describe('filterCounters', () => {
  it('sin filtros devuelve todos', () => {
    expect(filterCounters(counters, DEFAULT_FILTERS, folders, NOW)).toHaveLength(5);
  });

  it('por carpeta', () => {
    const result = filterCounters(counters, { ...DEFAULT_FILTERS, folderId: 'f1' }, folders, NOW);
    expect(ids(result)).toEqual(['privado-viejo', 'grupo-semana']);
  });

  it('individuales o de grupo', () => {
    expect(
      ids(filterCounters(counters, { ...DEFAULT_FILTERS, kind: 'individual' }, folders, NOW)),
    ).toEqual(['privado-hoy', 'privado-viejo']);
    expect(
      ids(filterCounters(counters, { ...DEFAULT_FILTERS, kind: 'group' }, folders, NOW)),
    ).toEqual(['grupo-semana', 'grupo-nunca', 'otro-grupo']);
  });

  it('de un grupo concreto', () => {
    const filters = { ...DEFAULT_FILTERS, kind: 'group' as const, groupId: 'g2' };
    expect(ids(filterCounters(counters, filters, folders, NOW))).toEqual(['otro-grupo']);
  });

  it('por actividad reciente (ventanas móviles)', () => {
    const day = filterCounters(counters, { ...DEFAULT_FILTERS, activity: 'day' }, folders, NOW);
    const week = filterCounters(counters, { ...DEFAULT_FILTERS, activity: 'week' }, folders, NOW);
    expect(ids(day)).toEqual(['privado-hoy']);
    expect(ids(week)).toEqual(['privado-hoy', 'grupo-semana']);
  });

  it('combina filtros', () => {
    const filters = {
      folderId: 'f1',
      kind: 'group' as const,
      groupId: null,
      activity: 'month' as const,
    };
    expect(ids(filterCounters(counters, filters, folders, NOW))).toEqual(['grupo-semana']);
  });

  it('una carpeta borrada no filtra nada', () => {
    const result = filterCounters(counters, { ...DEFAULT_FILTERS, folderId: 'x' }, folders, NOW);
    expect(result).toHaveLength(5);
  });
});

describe('activeFilterCount', () => {
  it('cuenta los filtros que no están por defecto', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(
      activeFilterCount({ folderId: 'f1', kind: 'group', groupId: 'g1', activity: 'day' }),
    ).toBe(3);
  });
});

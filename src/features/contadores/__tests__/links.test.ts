import type { CounterGroup, CounterWithTotal } from '../api';
import { applyLinks, visibleCounterId } from '../links';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const familia: CounterGroup = { id: 'g-fam', name: 'Familia', ownerId: 'x' };
const amigos: CounterGroup = { id: 'g-ami', name: 'Amigos', ownerId: 'y' };

function counter(id: string, group: CounterGroup | null, my: number, total: number) {
  return {
    id,
    group,
    isActive: true,
    myTotal: my,
    myEntryCount: my,
    myGroupTotal: my,
    displayTotal: my,
    total,
    lastLoggedAt: `2026-11-0${my % 9}T00:00:00Z`,
    linkedCounterIds: [id],
    linkedGroups: group ? [{ counterId: id, group, total }] : [],
    linkedInto: null,
  } as unknown as CounterWithTotal;
}

const fam = counter('fam', familia, 180, 300);
const ami = counter('ami', amigos, 20, 90);
const solo = counter('solo', null, 5, 5);
const links = [
  { counterId: 'fam', linkId: 'L', isPrimary: true },
  { counterId: 'ami', linkId: 'L', isPrimary: false },
];

describe('applyLinks', () => {
  const result = applyLinks([fam, ami, solo], links);

  it('el principal suma lo mío de todos y cuenta en ambos grupos', () => {
    const main = result.find((c) => c.id === 'fam');
    expect(main).toMatchObject({
      myTotal: 200,
      displayTotal: 200,
      linkedCounterIds: ['fam', 'ami'],
    });
    expect(main?.linkedGroups.map((g) => [g.group.name, g.total])).toEqual([
      ['Familia', 300],
      ['Amigos', 90],
    ]);
  });

  it('el secundario queda marcado para no salir en la lista', () => {
    expect(result.find((c) => c.id === 'ami')?.linkedInto).toBe('fam');
  });

  it('no toca los contadores sin enlace', () => {
    expect(result.find((c) => c.id === 'solo')).toBe(solo);
  });

  it('si el principal ya no está activo, lo representa otro', () => {
    const left = { ...fam, isActive: false } as CounterWithTotal;
    const again = applyLinks([left, ami], links);
    expect(again.find((c) => c.id === 'ami')?.linkedInto).toBeNull();
    expect(again.find((c) => c.id === 'fam')?.linkedInto).toBe('ami');
  });

  it('visibleCounterId lleva cada contador al que se ve', () => {
    const resolve = visibleCounterId(result);
    expect([resolve('fam'), resolve('ami'), resolve('solo'), resolve('otro')]).toEqual([
      'fam',
      'fam',
      'solo',
      'otro',
    ]);
  });
});

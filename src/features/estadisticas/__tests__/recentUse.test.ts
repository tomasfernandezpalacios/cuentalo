import type { CounterWithTotal } from '@/features/contadores/api';

import { sortByRecentUse } from '../recentUse';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

function counter(id: string, name: string, lastLoggedAt: string | null) {
  return { id, name, lastLoggedAt } as CounterWithTotal;
}

const day = (counterId: string, d: string) => ({ counterId, day: d, total: 1, entryCount: 1 });

describe('sortByRecentUse', () => {
  it('ordena por mi último día de uso, desempata por hora y deja al final los no usados', () => {
    const counters = [
      counter('libros', 'Libros', null),
      counter('cafe', 'Café', '2026-11-04T08:00:00Z'),
      counter('agua', 'Agua', '2026-11-04T20:00:00Z'),
      counter('km', 'Kilómetros', '2026-10-01T10:00:00Z'),
      counter('cine', 'Cine', null),
    ];
    const days = [
      day('km', '2026-10-01'),
      day('cafe', '2026-11-04'),
      day('agua', '2026-11-04'),
      day('cafe', '2026-11-01'),
    ];
    expect(sortByRecentUse(counters, days).map((c) => c.id)).toEqual([
      'agua',
      'cafe',
      'km',
      'cine',
      'libros',
    ]);
  });
});

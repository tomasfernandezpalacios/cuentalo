import { streakIncrease } from '../streakCelebration';

jest.mock('@/features/contadores/hooks', () => ({ counterKeys: { all: ['counters'] } }));

describe('streakIncrease', () => {
  const days = ['2026-11-01', '2026-11-02', '2026-11-03'];

  it('primer registro de hoy con la racha de ayer viva: sube un día', () => {
    expect(streakIncrease(days, '2026-11-04')).toEqual({ from: 3, to: 4 });
  });

  it('racha rota: empieza en 1', () => {
    expect(streakIncrease(days, '2026-11-06')).toEqual({ from: 0, to: 1 });
  });

  it('sin días: de 0 a 1', () => {
    expect(streakIncrease([], '2026-11-06')).toEqual({ from: 0, to: 1 });
  });

  it('si hoy ya había registro, no hay celebración', () => {
    expect(streakIncrease([...days, '2026-11-04'], '2026-11-04')).toBeNull();
  });
});

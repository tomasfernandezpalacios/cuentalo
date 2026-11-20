import { bumpStreak } from '../streakOptimistic';

const base = { current: 3, best: 5, todayDone: false, todayAmount: 0 };

describe('bumpStreak (racha al instante)', () => {
  it('el primer +1 del día alarga la racha y la ilumina', () => {
    expect(bumpStreak(base, 1)).toEqual({ current: 4, best: 5, todayDone: true, todayAmount: 1 });
  });

  it('sin racha viva, empieza en 1', () => {
    expect(bumpStreak({ current: 0, best: 0, todayDone: false, todayAmount: 0 }, 2)).toEqual({
      current: 1,
      best: 1,
      todayDone: true,
      todayAmount: 2,
    });
  });

  it('más sumas el mismo día no la alargan otra vez', () => {
    const done = bumpStreak(base, 1);
    expect(bumpStreak(done, 1).current).toBe(4);
  });

  it('un −1 que deja hoy por debajo de +1 la devuelve a lo de ayer', () => {
    const done = bumpStreak(base, 1);
    expect(bumpStreak(done, -1)).toEqual({ current: 3, best: 5, todayDone: false, todayAmount: 0 });
  });

  it('el récord sube si se supera', () => {
    expect(bumpStreak({ current: 5, best: 5, todayDone: false, todayAmount: 0 }, 1).best).toBe(6);
  });
});

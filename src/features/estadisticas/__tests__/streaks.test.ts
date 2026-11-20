import {
  bestStreak,
  currentStreak,
  monthGrid,
  shieldsToUse,
  weekProgress,
  withPositions,
} from '../streaks';

describe('protectores de racha', () => {
  const days = ['2026-11-01', '2026-11-02', '2026-11-04'];

  it('un día protegido une la racha sin sumarla', () => {
    expect(currentStreak(days, '2026-11-04')).toBe(1);
    expect(currentStreak(days, '2026-11-04', ['2026-11-03'])).toBe(3);
    expect(bestStreak(days, ['2026-11-03'])).toBe(3);
  });

  it('se gasta uno si ayer no hubo nada y la racha venía viva', () => {
    expect(shieldsToUse(['2026-11-01', '2026-11-02'], [], 1, '2026-11-04')).toEqual(['2026-11-03']);
  });

  it('no se gasta si ayer hubo actividad o no hay protectores', () => {
    expect(shieldsToUse(['2026-11-03'], [], 2, '2026-11-04')).toEqual([]);
    expect(shieldsToUse(['2026-11-01'], [], 0, '2026-11-03')).toEqual([]);
  });

  it('cubre varios días seguidos solo si hay protectores para todos', () => {
    expect(shieldsToUse(['2026-11-01'], [], 2, '2026-11-04')).toEqual(['2026-11-02', '2026-11-03']);
    expect(shieldsToUse(['2026-11-01'], [], 1, '2026-11-04')).toEqual([]);
  });

  it('sin ninguna actividad antes no hay racha que proteger', () => {
    expect(shieldsToUse([], [], 2, '2026-11-04')).toEqual([]);
  });
});

describe('currentStreak', () => {
  const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-10-20'];

  it('cuenta desde hoy si hoy hay actividad', () => {
    expect(currentStreak([...days, '2026-11-04'], '2026-11-04')).toBe(4);
  });

  it('la racha de ayer sigue viva mientras no acabe el día', () => {
    expect(currentStreak(days, '2026-11-04')).toBe(3);
  });

  it('si ayer no hubo actividad, vuelve a 0', () => {
    expect(currentStreak(days, '2026-11-05')).toBe(0);
  });

  it('un usuario nuevo con un registro hoy tiene 1', () => {
    expect(currentStreak(['2026-11-04'], '2026-11-04')).toBe(1);
    expect(currentStreak([], '2026-11-04')).toBe(0);
  });

  it('cruza meses y años', () => {
    expect(currentStreak(['2025-12-30', '2025-12-31', '2026-01-01'], '2026-01-01')).toBe(3);
  });
});

describe('bestStreak', () => {
  it('encuentra la racha más larga', () => {
    expect(bestStreak(['2026-01-01', '2026-01-02', '2026-03-01', '2026-03-02', '2026-03-03'])).toBe(
      3,
    );
    expect(bestStreak([])).toBe(0);
  });
});

describe('monthGrid', () => {
  it('noviembre de 2026 empieza en domingo y tiene 6 semanas', () => {
    const weeks = monthGrid(2026, 11);
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks[5]?.[0]).toBe('2026-11-30');
  });

  it('febrero de un año bisiesto tiene 29 días', () => {
    expect(monthGrid(2024, 2).flat().filter(Boolean)).toHaveLength(29);
  });
});

describe('withPositions', () => {
  it('los empates comparten puesto', () => {
    const rows = [{ v: 9 }, { v: 5 }, { v: 5 }, { v: 1 }];
    expect(withPositions(rows, (r) => r.v).map((r) => r.position)).toEqual([1, 2, 2, 4]);
  });
});

describe('weekProgress', () => {
  it('devuelve la semana de lunes a domingo con los días mantenidos', () => {
    // 2026-11-04 es miércoles.
    const week = weekProgress(['2026-11-02', '2026-11-04', '2026-10-31'], '2026-11-04');
    expect(week.map((d) => d.day)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
    expect(week.map((d) => d.done)).toEqual([true, false, true, false, false, false, false]);
    expect(week.map((d) => d.future)).toEqual([false, false, false, true, true, true, true]);
    expect(week.find((d) => d.isToday)?.letter).toBe('X');
  });

  it('el domingo es el último día de la semana', () => {
    const week = weekProgress([], '2026-11-08');
    expect(week[0]?.day).toBe('2026-11-02');
    expect(week[6]?.isToday).toBe(true);
  });
});

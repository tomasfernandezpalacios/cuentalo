import { bestStreak, currentStreak, monthGrid } from '../streaks';

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

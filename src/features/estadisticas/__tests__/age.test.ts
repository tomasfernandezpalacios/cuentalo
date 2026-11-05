import { ageBreakdown, birthStart, isValidBirthDate, totalsLived } from '../age';

describe('ageBreakdown', () => {
  it('cuenta años, meses, semanas, días y la hora del día', () => {
    const birth = birthStart('2008-03-10');
    const now = new Date(2026, 10, 5, 14, 30, 15); // 5 nov 2026, 14:30:15
    expect(ageBreakdown(birth, now)).toEqual({
      years: 18,
      months: 7,
      weeks: 3, // del 10 oct al 5 nov: 26 días = 3 semanas y 5 días
      days: 5,
      hours: 14,
      minutes: 30,
      seconds: 15,
    });
  });

  it('el día del cumpleaños son años justos', () => {
    const birth = birthStart('2000-11-05');
    expect(ageBreakdown(birth, new Date(2026, 10, 5, 0, 0, 0))).toMatchObject({
      years: 26,
      months: 0,
      weeks: 0,
      days: 0,
      hours: 0,
    });
  });

  it('el día antes del cumpleaños aún no cumple', () => {
    const birth = birthStart('2000-11-05');
    expect(ageBreakdown(birth, new Date(2026, 10, 4, 23, 0, 0)).years).toBe(25);
  });

  it('los nacidos un 31 cumplen mes en el último día de los meses cortos', () => {
    const birth = birthStart('2026-01-31');
    expect(ageBreakdown(birth, new Date(2026, 1, 28, 12, 0, 0))).toMatchObject({
      months: 1,
      days: 0,
      hours: 12,
    });
  });
});

describe('totalsLived', () => {
  it('días, horas y minutos completos', () => {
    const birth = birthStart('2026-11-01');
    expect(totalsLived(birth, new Date(2026, 10, 3, 1, 30, 0))).toEqual({
      days: 2,
      hours: 49,
      minutes: 2970,
    });
  });
});

describe('isValidBirthDate', () => {
  const today = new Date(2026, 10, 5);
  it('acepta fechas pasadas y rechaza futuras o imposibles', () => {
    expect(isValidBirthDate('2008-03-10', today)).toBe(true);
    expect(isValidBirthDate('2027-01-01', today)).toBe(false);
    expect(isValidBirthDate('1890-01-01', today)).toBe(false);
    expect(isValidBirthDate('ayer', today)).toBe(false);
  });
});

import { daysInMonth, isLeapYear, selectableYears, yearMonths } from '../yearGrid';

describe('yearGrid', () => {
  it('bisiestos', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  it('un cuadrado por día: 365 o 366', () => {
    expect(yearMonths(2026).flat()).toHaveLength(365);
    expect(yearMonths(2028).flat()).toHaveLength(366);
    expect(daysInMonth(2028, 2)).toBe(29);
  });

  it('doce meses, del 1 de enero al 31 de diciembre', () => {
    const months = yearMonths(2026);
    expect(months).toHaveLength(12);
    expect(months[0]?.[0]).toBe('2026-01-01');
    expect(months[1]?.at(-1)).toBe('2026-02-28');
    expect(months[11]?.at(-1)).toBe('2026-12-31');
  });

  it('años elegibles: del primer registro al actual', () => {
    expect(selectableYears('2026-11-19', '2024-05-02')).toEqual([2024, 2025, 2026]);
    expect(selectableYears('2026-11-19', null)).toEqual([2026]);
  });
});

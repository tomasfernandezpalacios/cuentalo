import { isOldEnough } from '../legal';

describe('isOldEnough', () => {
  const today = new Date(2026, 10, 17); // 17 nov 2026

  it('cumple justo hoy', () => {
    expect(isOldEnough('2012-11-17', today, 14)).toBe(true);
  });

  it('le falta un día', () => {
    expect(isOldEnough('2012-11-18', today, 14)).toBe(false);
  });

  it('mucho mayor', () => {
    expect(isOldEnough('1990-01-01', today, 14)).toBe(true);
  });

  it('29 de febrero cumple el 1 de marzo en años no bisiestos', () => {
    expect(isOldEnough('2012-02-29', new Date(2026, 1, 28), 14)).toBe(false);
    expect(isOldEnough('2012-02-29', new Date(2026, 2, 1), 14)).toBe(true);
  });

  it('fecha mal escrita', () => {
    expect(isOldEnough('', today, 14)).toBe(false);
    expect(isOldEnough('17/11/2000', today, 14)).toBe(false);
  });
});

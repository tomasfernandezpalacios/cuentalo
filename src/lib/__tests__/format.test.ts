import { formatSignedWithUnit, formatWithUnit } from '../format';

describe('formatWithUnit', () => {
  it('añade la unidad solo si existe', () => {
    expect(formatWithUnit(12, 'cervezas')).toBe('12 cervezas');
    expect(formatWithUnit(2.5, null)).toBe('2,5');
  });
});

describe('formatSignedWithUnit', () => {
  it('muestra el signo de sumas y restas', () => {
    expect(formatSignedWithUnit(3, 'km')).toBe('+3 km');
    expect(formatSignedWithUnit(-1, 'km')).toBe('−1 km');
    expect(formatSignedWithUnit(-1, null)).toBe('−1');
  });
});

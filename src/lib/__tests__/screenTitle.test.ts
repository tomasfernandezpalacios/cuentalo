import { fitTitleSize, HEADER_RIGHT_WIDTH } from '../screenTitle';

jest.mock('../theme', () => ({ displayFont: () => ({}) }));

describe('fitTitleSize', () => {
  it('elige el mayor tamaño que cabe junto a la racha y los botones', () => {
    // 393 − 139 − 44 − 72 = 138 px para un texto que mide 560 px a tamaño 100 → 24.
    expect(fitTitleSize(393, 560, 72, 139)).toBe(24);
  });

  it('no pasa de 30 en pantallas anchas ni baja de 20 en estrechas', () => {
    expect(fitTitleSize(1000, 560, 72)).toBe(30);
    expect(fitTitleSize(300, 560, 72)).toBe(20);
  });

  it('sin medir todavía, un tamaño razonable', () => {
    expect(fitTitleSize(393, 0, 72)).toBe(28);
  });

  it('«Mis contadores» en Fraunces ExtraBold (774 px a 100) sale grande: 30, o 28 en 360 px', () => {
    expect(fitTitleSize(411, 774, 0)).toBe(30);
    expect(fitTitleSize(360, 774, 0)).toBe(28);
  });

  it('usa el ancho de los botones de la derecha', () => {
    expect(HEADER_RIGHT_WIDTH).toBeGreaterThan(0);
  });
});

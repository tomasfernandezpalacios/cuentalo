import { contrastRatio, customAccent, hexToHsv, hsvToHex, normalizeHex } from '../color';

const base = {
  lightBackground: '#F7F7FA',
  darkBackground: '#0E0E12',
  lightOnPrimary: '#FFFFFF',
  darkOnPrimary: '#0E0E12',
};

describe('normalizeHex', () => {
  it('acepta con o sin # y en minúsculas', () => {
    expect(normalizeHex('5b4bdb')).toBe('#5B4BDB');
    expect(normalizeHex(' #12abEF ')).toBe('#12ABEF');
  });
  it('rechaza lo que no es un color', () => {
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('rojo')).toBeNull();
  });
});

describe('hsv', () => {
  it('convierte ida y vuelta', () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe('#FF0000');
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00FF00');
    expect(hsvToHex(hexToHsv('#5B4BDB'))).toBe('#5B4BDB');
  });
});

describe('customAccent', () => {
  it('los botones siempre tienen contraste AA con su texto, en los dos modos', () => {
    for (const hex of ['#FFEE00', '#00FFFF', '#111111', '#5B4BDB', '#FFFFFF']) {
      const accent = customAccent(hex, base);
      expect(contrastRatio(accent.light.primary, base.lightOnPrimary)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(accent.dark.primary, base.darkOnPrimary)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('un color que ya cumple no se toca', () => {
    expect(customAccent('#5B4BDB', base).light.primary).toBe('#5B4BDB');
  });
});

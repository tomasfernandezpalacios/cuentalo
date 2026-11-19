import { hexToHsv, hsvToHex, normalizeHex } from '../color';

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

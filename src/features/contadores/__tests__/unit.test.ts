import { suggestUnit } from '../unit';

describe('suggestUnit', () => {
  it('propone la primera palabra del nombre, en minúscula', () => {
    expect(suggestUnit('Kilómetros')).toBe('kilómetros');
    expect(suggestUnit('Países visitados')).toBe('países');
    expect(suggestUnit('Días sin fumar')).toBe('días');
  });

  it('se salta emoticonos y signos; sin nombre, nada', () => {
    expect(suggestUnit('🍺 Cervezas con amigos')).toBe('cervezas');
    expect(suggestUnit('  ')).toBe('');
  });
});

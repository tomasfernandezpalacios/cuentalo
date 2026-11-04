import { matchesSearch } from '../search';

describe('matchesSearch', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(matchesSearch('Cafés', 'cafe')).toBe(true);
    expect(matchesSearch('Días sin fumar', 'DIAS')).toBe(true);
  });

  it('una búsqueda vacía vale todo y una que no está, nada', () => {
    expect(matchesSearch('Libros', '  ')).toBe(true);
    expect(matchesSearch('Libros', 'km')).toBe(false);
  });
});

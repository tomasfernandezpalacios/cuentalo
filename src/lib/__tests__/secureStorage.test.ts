import { splitIntoChunks } from '../secureStorage';

describe('splitIntoChunks', () => {
  it('trocea y al unir recupera el valor original', () => {
    const value = 'x'.repeat(4000);
    const chunks = splitIntoChunks(value, 1800);
    expect(chunks.map((c) => c.length)).toEqual([1800, 1800, 400]);
    expect(chunks.join('')).toBe(value);
  });

  it('devuelve un único trozo vacío para la cadena vacía', () => {
    expect(splitIntoChunks('')).toEqual(['']);
  });
});

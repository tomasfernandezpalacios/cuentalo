import { coinsToDraw } from '../coinBurst';
import { confettiPieces } from '../levelUp';

describe('monedas que vuelan', () => {
  it('dibuja entre 4 y 10 según lo ganado', () => {
    expect(coinsToDraw(2)).toBe(4);
    expect(coinsToDraw(35)).toBe(7);
    expect(coinsToDraw(500)).toBe(10);
  });
});

describe('confeti', () => {
  it('es siempre el mismo con la misma semilla y sale hacia arriba', () => {
    const a = confettiPieces(20, 7);
    expect(confettiPieces(20, 7)).toEqual(a);
    expect(a).toHaveLength(20);
    a.forEach((p) => expect(p.dy).toBeLessThan(0));
  });
});

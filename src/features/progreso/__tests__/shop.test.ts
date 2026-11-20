import { DANCES, dance } from '@/features/mascota/animations';
import { GESTURES } from '@/features/mascota/gestures';

import { MAX_LEVEL } from '../model';
import { CATALOG } from '../shop';

describe('catálogo', () => {
  it('no repite nombres internos', () => {
    const ids = CATALOG.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada cosa se consigue de una sola forma: comprándola, por nivel o desde el principio', () => {
    for (const item of CATALOG) {
      const ways = [item.price !== undefined, item.giftLevel !== undefined, !!item.starter];
      expect(ways.filter(Boolean)).toHaveLength(1);
      if (item.giftLevel !== undefined) {
        expect(item.giftLevel).toBeGreaterThan(1);
        expect(item.giftLevel).toBeLessThanOrEqual(MAX_LEVEL);
      }
    }
  });

  it('cada animación usa un movimiento que existe', () => {
    const moves = new Set<string>([...GESTURES, ...DANCES]);
    for (const item of CATALOG) {
      if (item.kind === 'animacion') expect(moves.has(item.move)).toBe(true);
    }
  });

  it('hay muchas cosas de cada tipo', () => {
    expect(CATALOG.filter((i) => i.kind === 'accesorio').length).toBeGreaterThanOrEqual(25);
    expect(CATALOG.filter((i) => i.kind === 'fondo').length).toBeGreaterThanOrEqual(20);
    expect(CATALOG.filter((i) => i.kind === 'animacion').length).toBeGreaterThanOrEqual(20);
  });
});

describe('animaciones', () => {
  it('dan posturas con números válidos en todo su recorrido', () => {
    for (const d of DANCES) {
      for (let f = 0; f < 120; f += 7) {
        const pose = dance(d, f);
        for (const value of Object.values(pose)) {
          if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });
});

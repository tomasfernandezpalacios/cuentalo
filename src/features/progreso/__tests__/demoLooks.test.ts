import { demoLookFor } from '../demoLooks';

describe('mascota de otra persona (prueba)', () => {
  it('es siempre la misma para la misma persona', () => {
    expect(demoLookFor('abc-123')).toEqual(demoLookFor('abc-123'));
  });

  it('cambia entre personas y nunca usa el fondo liso', () => {
    const looks = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => demoLookFor(`usuario-${id}`));
    expect(new Set(looks.map((l) => l.background)).size).toBeGreaterThan(1);
    looks.forEach((l) => {
      expect(l.background).not.toBe('papel');
      expect(l.accessories.length).toBeGreaterThanOrEqual(1);
    });
  });
});

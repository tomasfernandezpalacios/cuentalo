import { GESTURES, gesture, gesturePose } from '../gestures';

describe('gestos de la mascota', () => {
  it('todos dan posturas válidas en cualquier fotograma', () => {
    for (const g of GESTURES) {
      for (let f = 0; f < 300; f += 1) {
        const p = gesture(g, f);
        for (const v of Object.values(p)) expect(Number.isFinite(v)).toBe(true);
        expect(p.scale).toBeGreaterThan(0);
        expect(p.squashY).toBeGreaterThan(0.7);
        expect(p.mouth).toBeGreaterThan(0.3);
        expect(p.limbs).toBe(1);
        // Las pupilas no se salen del ojo.
        expect(Math.abs(p.look)).toBeLessThanOrEqual(0.1);
        expect(Math.abs(p.lookY ?? 0)).toBeLessThanOrEqual(0.12);
      }
    }
  });

  it('salen con un rebote: de casi nada a su tamaño', () => {
    for (const g of GESTURES) {
      expect(gesture(g, 0).scale).toBeLessThan(0.05);
      expect(gesture(g, 20).scale).toBeCloseTo(1, 1);
    }
  });

  it('el movimiento es el mismo siempre para el mismo fotograma', () => {
    for (const g of GESTURES) expect(gesture(g, 37)).toEqual(gesture(g, 37));
  });

  it('«hello» da una vuelta entera y termina de cara', () => {
    expect(gesturePose('hello', 0).roll).toBeCloseTo(0);
    expect(gesturePose('hello', 16).roll).toBeCloseTo(Math.PI * 2);
  });

  it('señalar arriba y abajo mira hacia donde señala', () => {
    expect(gesturePose('pointUp', 5).lookY!).toBeLessThan(0);
    expect(gesturePose('pointDown', 5).lookY!).toBeGreaterThan(0);
    expect(gesturePose('pointUp', 5).rightArm).toBeGreaterThan(
      gesturePose('pointDown', 5).rightArm,
    );
  });

  it('los saltos suben (y negativa) y vuelven al suelo', () => {
    for (const g of ['cheer', 'hop', 'fire'] as const) {
      const ys = Array.from({ length: 22 }, (_, f) => gesturePose(g, f).y);
      expect(Math.min(...ys)).toBeLessThan(-20);
      expect(Math.max(...ys)).toBeLessThanOrEqual(0);
    }
  });
});

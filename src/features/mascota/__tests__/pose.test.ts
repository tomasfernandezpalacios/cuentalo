import {
  BAR_X0,
  BAR_X1,
  BALL_R,
  CENTER_FRAME,
  CENTER_X,
  END_FRAME,
  JUMP_X,
  LINE_Y,
  SPEED,
  coverFraction,
  pose,
} from '../pose';

describe('pose de la mascota', () => {
  it('no se ve antes de entrar ni después de salir', () => {
    expect(pose(-1)).toBeNull();
    expect(pose(END_FRAME + 1)).toBeNull();
  });

  it('entra rodando por la izquierda, sobre la barra y sin extremidades', () => {
    const p = pose(0)!;
    expect(p.x).toBeCloseTo(-BALL_R);
    expect(p.y).toBe(LINE_Y);
    expect(p.limbs).toBe(0);
  });

  it('rueda a velocidad constante y el giro sale de la distancia', () => {
    const a = pose(5)!;
    const b = pose(15)!;
    expect(b.x - a.x).toBeCloseTo(SPEED * 10);
    expect(b.roll - a.roll).toBeCloseTo((SPEED * 10) / BALL_R);
  });

  it('salta al 70 % de la barra sin frenar', () => {
    expect(JUMP_X).toBeCloseTo(BAR_X0 + 0.7 * (BAR_X1 - BAR_X0));
    const before = pose(31.99)!;
    const after = pose(32.01)!;
    expect(before.x).toBeCloseTo(JUMP_X, 0);
    expect(after.x - before.x).toBeCloseTo(SPEED * 0.02, 1);
  });

  it('sube y baja en parábola y le salen las extremidades en el aire', () => {
    const ys = [33, 36, 40, 44, 48].map((f) => pose(f)!.y);
    const top = Math.min(...ys);
    expect(top).toBeLessThan(LINE_Y - 250);
    // Primero sube y luego baja.
    expect(ys[0]).toBeGreaterThan(ys[1]!);
    expect(ys[4]).toBeGreaterThan(top);
    expect(pose(42)!.limbs).toBeCloseTo(1, 0);
  });

  it('sale por la derecha todavía en el aire', () => {
    const last = pose(END_FRAME - 0.5)!;
    expect(last.y).toBeLessThan(LINE_Y);
  });

  it('pasa por el centro de la barra (el número) en CENTER_FRAME', () => {
    expect(pose(CENTER_FRAME)!.x).toBeCloseTo(CENTER_X);
  });
});

describe('coverFraction', () => {
  it('va de 0 a 1 entre los dos extremos de la barra', () => {
    expect(coverFraction(-100)).toBe(0);
    expect(coverFraction(BAR_X0)).toBe(0);
    expect(coverFraction(CENTER_X)).toBeCloseTo(0.5);
    expect(coverFraction(BAR_X1)).toBe(1);
    expect(coverFraction(2000)).toBe(1);
  });
});

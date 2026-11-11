import { gridDropIndex, slotPositions } from '../reorder';

const cell = { width: 100, height: 100 };

describe('slotPositions', () => {
  it('lista: uno debajo de otro con su altura y el hueco', () => {
    expect(
      slotPositions(
        [
          { width: 300, height: 50 },
          { width: 300, height: 80 },
          { width: 300, height: 40 },
        ],
        1,
        10,
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 60 },
      { x: 0, y: 150 },
    ]);
  });

  it('cuadrícula de 2: fila a fila', () => {
    expect(slotPositions([cell, cell, cell], 2, 10)).toEqual([
      { x: 0, y: 0 },
      { x: 110, y: 0 },
      { x: 0, y: 110 },
    ]);
  });
});

describe('gridDropIndex', () => {
  const sizes = [cell, cell, cell, cell, cell];

  it('se queda si apenas se mueve', () => {
    expect(gridDropIndex(sizes, 2, 10, 0, 20, 30)).toBe(0);
  });

  it('a la derecha y abajo', () => {
    expect(gridDropIndex(sizes, 2, 10, 0, 110, 0)).toBe(1);
    expect(gridDropIndex(sizes, 2, 10, 0, 0, 110)).toBe(2);
    expect(gridDropIndex(sizes, 2, 10, 0, 110, 110)).toBe(3);
  });

  it('nunca pasa del último ni sale de la cuadrícula', () => {
    expect(gridDropIndex(sizes, 2, 10, 0, 500, 500)).toBe(4);
    expect(gridDropIndex(sizes, 2, 10, 3, -500, -500)).toBe(0);
  });
});

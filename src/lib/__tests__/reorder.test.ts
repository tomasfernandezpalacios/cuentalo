import { applyOrder, dropIndex, moveItem, withFirst } from '../reorder';

describe('moveItem', () => {
  it('mueve hacia abajo y hacia arriba', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

describe('applyOrder', () => {
  const items = [{ id: 'x' }, { id: 'y' }, { id: 'z' }, { id: 'nuevo' }];
  it('sigue el orden guardado y deja al final los que no están', () => {
    expect(applyOrder(items, ['z', 'x', 'y'], (i) => i.id).map((i) => i.id)).toEqual([
      'z',
      'x',
      'y',
      'nuevo',
    ]);
  });
  it('sin orden guardado no cambia nada', () => {
    expect(applyOrder(items, null, (i) => i.id)).toBe(items);
  });
});

describe('dropIndex', () => {
  const heights = [100, 100, 100, 100];
  it('no se mueve hasta pasar la mitad del vecino', () => {
    expect(dropIndex(heights, 1, 40)).toBe(1);
    expect(dropIndex(heights, 1, 60)).toBe(2);
    expect(dropIndex(heights, 1, 160)).toBe(3);
    expect(dropIndex(heights, 1, 900)).toBe(3);
    expect(dropIndex(heights, 2, -60)).toBe(1);
    expect(dropIndex(heights, 2, -900)).toBe(0);
  });
});

describe('withFirst', () => {
  it('pone el nuevo el primero y no lo repite', () => {
    expect(withFirst(['a', 'b'], 'c')).toEqual(['c', 'a', 'b']);
    expect(withFirst(['a', 'c', 'b'], 'c')).toEqual(['c', 'a', 'b']);
    expect(withFirst([], 'c')).toEqual(['c']);
  });

  it('con el orden aplicado, el nuevo sale el primero aunque no hubiera orden guardado', () => {
    const items = ['a', 'b', 'c'];
    expect(applyOrder(items, withFirst([], 'c'), (x) => x)).toEqual(['c', 'a', 'b']);
  });
});

import { isSwiping, isTap, markSwipeEnd, markSwipeStart, resetTapGuard } from '../tapGuard';

describe('isTap', () => {
  it('acepta un toque que apenas se mueve', () => {
    expect(isTap({ x: 100, y: 100 }, { x: 105, y: 97 })).toBe(true);
  });

  it('rechaza un deslizamiento horizontal o vertical', () => {
    expect(isTap({ x: 100, y: 100 }, { x: 140, y: 100 })).toBe(false);
    expect(isTap({ x: 100, y: 100 }, { x: 100, y: 130 })).toBe(false);
  });

  it('acepta el toque si no hay posición (lector de pantalla)', () => {
    expect(isTap(null, { x: 0, y: 0 })).toBe(true);
    expect(isTap({ x: 100, y: 100 }, { x: undefined, y: undefined })).toBe(true);
  });
});

describe('isSwiping', () => {
  beforeEach(resetTapGuard);

  it('es verdad mientras se desliza y un momento después', () => {
    expect(isSwiping(1000)).toBe(false);
    markSwipeStart();
    expect(isSwiping(1000)).toBe(true);
    markSwipeEnd(2000);
    expect(isSwiping(2100)).toBe(true);
    expect(isSwiping(2300)).toBe(false);
  });
});

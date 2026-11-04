import { clampView, cropRect } from '../photoCrop';

const wide = { width: 2000, height: 1000 };

describe('clampView', () => {
  it('no deja que la imagen descubra el marco', () => {
    // Zoom 1: el alto cubre justo el marco (300) y el ancho mide 600: se mueve ±150 en X.
    expect(clampView(wide, 300, { zoom: 1, x: 500, y: 40 })).toEqual({ zoom: 1, x: 150, y: 0 });
  });

  it('limita el zoom entre 1 y 4', () => {
    expect(clampView(wide, 300, { zoom: 0.5, x: 0, y: 0 }).zoom).toBe(1);
    expect(clampView(wide, 300, { zoom: 9, x: 0, y: 0 }).zoom).toBe(4);
  });
});

describe('cropRect', () => {
  it('sin mover ni ampliar recorta el cuadrado del centro', () => {
    expect(cropRect(wide, 300, { zoom: 1, x: 0, y: 0 })).toEqual({
      originX: 500,
      originY: 0,
      width: 1000,
      height: 1000,
    });
  });

  it('movida a la derecha del todo, se ve el borde izquierdo de la imagen', () => {
    expect(cropRect(wide, 300, { zoom: 1, x: 150, y: 0 }).originX).toBe(0);
  });

  it('con zoom 2 recorta la mitad de lado', () => {
    expect(cropRect(wide, 300, { zoom: 2, x: 0, y: 0 })).toEqual({
      originX: 750,
      originY: 250,
      width: 500,
      height: 500,
    });
  });
});

// Cuentas del editor de fotos (funciones puras). La imagen se ve dentro de un marco cuadrado de
// lado `frame`: con zoom 1 lo cubre justo (como «cover») y se puede mover y ampliar.

export type ImageDims = { width: number; height: number };
export type View = { zoom: number; x: number; y: number };

export const MAX_ZOOM = 4;

/** Píxeles de pantalla por píxel de la imagen. */
export function displayScale(image: ImageDims, frame: number, zoom: number): number {
  return (frame / Math.min(image.width, image.height)) * zoom;
}

/** Limita el zoom (1–4) y el desplazamiento para que la imagen cubra siempre el marco. */
export function clampView(image: ImageDims, frame: number, view: View): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom));
  const scale = displayScale(image, frame, zoom);
  const maxX = (image.width * scale - frame) / 2;
  const maxY = (image.height * scale - frame) / 2;
  const clamp = (v: number, max: number) => Math.min(max, Math.max(-max, v));
  return { zoom, x: clamp(view.x, maxX), y: clamp(view.y, maxY) };
}

/** El trozo de la imagen original (en sus píxeles) que se ve dentro del marco. */
export function cropRect(image: ImageDims, frame: number, view: View) {
  const scale = displayScale(image, frame, view.zoom);
  const size = Math.min(Math.round(frame / scale), image.width, image.height);
  const originX = Math.round((image.width * scale - frame) / 2 / scale - view.x / scale);
  const originY = Math.round((image.height * scale - frame) / 2 / scale - view.y / scale);
  return {
    originX: Math.min(Math.max(0, originX), image.width - size),
    originY: Math.min(Math.max(0, originY), image.height - size),
    width: size,
    height: size,
  };
}

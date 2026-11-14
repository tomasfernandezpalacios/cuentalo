// Geometría del foco y del bocadillo del tutorial. Funciones puras para poder testearlas.
//
// Todas llevan la directiva 'worklet': el tutorial las usa en el hilo de la interfaz (Reanimated)
// para medir, colocar y animar sin pasar por JavaScript. Fuera de él son funciones normales.

export type Rect = { x: number; y: number; width: number; height: number };
export type Screen = { width: number; height: number; top: number; bottom: number };

/** Margen alrededor del elemento iluminado. */
export const HOLE_PADDING = 8;
/** Margen hacia dentro cuando se ilumina una pantalla entera. */
export const PAGE_INSET = 8;
/** Radio de las esquinas del hueco (las piezas de las esquinas tienen este tamaño). */
export const HOLE_RADIUS = 14;
/** Hueco entre el foco y el bocadillo, donde asoma su piquito. */
export const BUBBLE_GAP = 16;
/** Margen del bocadillo con los lados de la pantalla (el bocadillo va de lado a lado). */
export const SIDE_MARGIN = 16;

/** Bordes del hueco iluminado (izquierda, arriba, derecha, abajo). */
export type Edges = { left: number; top: number; right: number; bottom: number };

/** Hueco iluminado: el elemento con un poco de margen alrededor. */
export function holeFor(target: Rect): Edges {
  'worklet';
  return {
    left: target.x - HOLE_PADDING,
    top: target.y - HOLE_PADDING,
    right: target.x + target.width + HOLE_PADDING,
    bottom: target.y + target.height + HOLE_PADDING,
  };
}

/** Hueco para presentar una pantalla entera: su zona de contenido con un margen hacia dentro. */
export function holeInside(page: Rect): Edges {
  'worklet';
  return {
    left: page.x + PAGE_INSET,
    top: page.y + PAGE_INSET,
    right: page.x + page.width - PAGE_INSET,
    bottom: page.y + page.height - PAGE_INSET,
  };
}

/**
 * Forma del hueco para un elemento: margen alrededor (negativo = por dentro, para pantallas
 * enteras) y radio de las esquinas. `pill`: tan redondo como permite el hueco (botones en
 * píldora, círculos, la barra de pestañas).
 */
export type HoleShape = { padding: number; radius: number; pill?: boolean };

export const DEFAULT_SHAPE: HoleShape = { padding: HOLE_PADDING, radius: HOLE_RADIUS };

/** Hueco con la forma del elemento: bordes y radio de las esquinas (nunca más que medio lado). */
export function shapedHole(target: Rect, shape: HoleShape): { edges: Edges; radius: number } {
  'worklet';
  const p = shape.padding;
  const edges = {
    left: target.x - p,
    top: target.y - p,
    right: target.x + target.width + p,
    bottom: target.y + target.height + p,
  };
  const max = Math.max(0, Math.min(edges.right - edges.left, edges.bottom - edges.top) / 2);
  return { edges, radius: shape.pill ? max : Math.min(shape.radius, max) };
}

/** Hueco cerrado en un punto (todo apagado): desde ahí se abre el siguiente, como un iris. */
export function closedHole(x: number, y: number): Edges {
  'worklet';
  return { left: x, top: y, right: x, bottom: y };
}

export function centerOf(edges: Edges): { x: number; y: number } {
  'worklet';
  return { x: (edges.left + edges.right) / 2, y: (edges.top + edges.bottom) / 2 };
}

/** El hueco cerrado sobre su propio centro (el iris que se cierra donde estaba). */
export function closeAt(edges: Edges): Edges {
  'worklet';
  const c = centerOf(edges);
  return closedHole(c.x, c.y);
}

export function isClosed(edges: Edges): boolean {
  'worklet';
  return edges.right - edges.left < 1 || edges.bottom - edges.top < 1;
}

/** ¿Se ve el elemento entero dentro de la capa? (no está en otra página ni fuera de pantalla) */
export function isVisibleIn(rect: Rect, width: number, height: number): boolean {
  'worklet';
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.x >= -2 &&
    rect.y >= -2 &&
    rect.x + rect.width <= width + 2 &&
    rect.y + rect.height <= height + 2
  );
}

/** Duraciones (ms) del deslizamiento del foco: cortas si se mueve poco, nunca más de GLIDE_MAX. */
export const GLIDE_MIN = 340;
export const GLIDE_MAX = 560;

/**
 * Lo que tarda el foco en ir de unos bordes a otros: proporcional a lo que se mueve el borde que
 * más se mueve, entre GLIDE_MIN y GLIDE_MAX. Así un salto corto no se hace lento ni uno largo
 * brusco, y todos los movimientos tienen la misma «velocidad» aparente.
 */
export function glideDuration(from: Edges, to: Edges): number {
  'worklet';
  const distance = Math.max(
    Math.abs(from.left - to.left),
    Math.abs(from.top - to.top),
    Math.abs(from.right - to.right),
    Math.abs(from.bottom - to.bottom),
  );
  return Math.round(Math.min(GLIDE_MAX, Math.max(GLIDE_MIN, GLIDE_MIN + distance * 0.35)));
}

export type BubblePlacement = {
  placement: 'above' | 'below';
  /** Posición vertical del bocadillo. */
  top: number;
  /** Posición horizontal del piquito: el centro del hueco, sin salirse del bocadillo. */
  caretX: number;
  /** ¿Lleva piquito? Solo si el bocadillo queda fuera del hueco. */
  caret: boolean;
};

/**
 * Dónde poner el bocadillo: debajo del foco si cabe; si no, encima; si no cabe en ninguno (la
 * pantalla entera iluminada), dentro, abajo del todo y sin piquito. Nunca se sale de la zona
 * segura. Con el hueco cerrado (todo apagado), en el centro de la pantalla.
 */
export function placeBubble(hole: Edges, bubbleHeight: number, screen: Screen): BubblePlacement {
  'worklet';
  const minTop = screen.top + SIDE_MARGIN;
  const maxBottom = screen.height - screen.bottom - SIDE_MARGIN;
  const clampTop = (value: number) =>
    Math.min(Math.max(value, minTop), Math.max(minTop, maxBottom - bubbleHeight));
  if (isClosed(hole)) {
    return {
      placement: 'above',
      top: clampTop((screen.height - bubbleHeight) / 2),
      caretX: screen.width / 2,
      caret: false,
    };
  }
  const spaceBelow = maxBottom - (hole.bottom + BUBBLE_GAP);
  const spaceAbove = hole.top - BUBBLE_GAP - minTop;

  let placement: BubblePlacement['placement'];
  let rawTop: number;
  if (spaceBelow >= bubbleHeight) {
    placement = 'below';
    rawTop = hole.bottom + BUBBLE_GAP;
  } else if (spaceAbove >= bubbleHeight) {
    placement = 'above';
    rawTop = hole.top - BUBBLE_GAP - bubbleHeight;
  } else {
    // No cabe fuera: dentro del hueco, pegado abajo.
    placement = 'above';
    rawTop = Math.min(hole.bottom, maxBottom) - SIDE_MARGIN - bubbleHeight;
  }
  const top = clampTop(rawTop);
  const center = (hole.left + hole.right) / 2;
  const caretX = Math.min(Math.max(center, SIDE_MARGIN + 28), screen.width - SIDE_MARGIN - 28);
  const caret = placement === 'below' ? top >= hole.bottom : top + bubbleHeight <= hole.top;
  return { placement, top, caretX, caret };
}

/** ¿Han cambiado dos medidas? (para saber si un elemento se ha quedado quieto) */
export function movedEnough(a: Rect, b: Rect, threshold = 0.5): boolean {
  'worklet';
  return (
    Math.abs(a.x - b.x) > threshold ||
    Math.abs(a.y - b.y) > threshold ||
    Math.abs(a.width - b.width) > threshold ||
    Math.abs(a.height - b.height) > threshold
  );
}

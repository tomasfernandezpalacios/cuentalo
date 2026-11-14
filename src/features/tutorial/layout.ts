// Geometría del foco y del bocadillo del tutorial. Funciones puras para poder testearlas.

export type Rect = { x: number; y: number; width: number; height: number };
export type Screen = { width: number; height: number; top: number; bottom: number };

/** Margen alrededor del elemento iluminado. */
export const HOLE_PADDING = 8;
/** Radio de las esquinas del hueco (las piezas de las esquinas tienen este tamaño). */
export const HOLE_RADIUS = 14;
/** Hueco entre el foco y el bocadillo, donde asoma su piquito. */
export const BUBBLE_GAP = 16;
const SIDE_MARGIN = 16;

/** Bordes del hueco iluminado (izquierda, arriba, derecha, abajo). */
export type Edges = { left: number; top: number; right: number; bottom: number };

/** Hueco iluminado: el elemento con un poco de margen alrededor. */
export function holeFor(target: Rect): Edges {
  return {
    left: target.x - HOLE_PADDING,
    top: target.y - HOLE_PADDING,
    right: target.x + target.width + HOLE_PADDING,
    bottom: target.y + target.height + HOLE_PADDING,
  };
}

/** Hueco cerrado en un punto (todo apagado): desde ahí se abre el siguiente, como un iris. */
export function closedHole(x: number, y: number): Edges {
  return { left: x, top: y, right: x, bottom: y };
}

export function centerOf(edges: Edges): { x: number; y: number } {
  return { x: (edges.left + edges.right) / 2, y: (edges.top + edges.bottom) / 2 };
}

export function isClosed(edges: Edges): boolean {
  return edges.right - edges.left < 1 || edges.bottom - edges.top < 1;
}

/**
 * La pantalla entera, para presentarla: entre la cabecera y la barra de pestañas, con un poco de
 * margen. `headerHeight` y `tabBarSpace` son lo que ocupan arriba y abajo.
 */
export function screenHole(screen: Screen, headerHeight: number, tabBarSpace: number): Edges {
  return {
    left: 8,
    top: screen.top + headerHeight,
    right: screen.width - 8,
    bottom: screen.height - tabBarSpace,
  };
}

export type BubblePlacement = {
  placement: 'above' | 'below';
  /** Posición vertical del bocadillo. */
  top: number;
  /** Posición horizontal del piquito: el centro del hueco, sin salirse del bocadillo. */
  caretX: number;
};

/**
 * Dónde poner el bocadillo: debajo del foco si cabe; si no, encima; si no cabe en ninguno (la
 * pantalla entera iluminada), dentro, abajo del todo. Nunca se sale de la zona segura.
 */
export function placeBubble(hole: Edges, bubbleHeight: number, screen: Screen): BubblePlacement {
  const minTop = screen.top + SIDE_MARGIN;
  const maxBottom = screen.height - screen.bottom - SIDE_MARGIN;
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
    // No cabe fuera: dentro del hueco, pegado abajo (sin piquito que apunte a nada).
    placement = 'above';
    rawTop = Math.min(hole.bottom, maxBottom) - SIDE_MARGIN - bubbleHeight;
  }
  const top = Math.min(Math.max(rawTop, minTop), Math.max(minTop, maxBottom - bubbleHeight));
  const center = (hole.left + hole.right) / 2;
  const caretX = Math.min(Math.max(center, SIDE_MARGIN + 28), screen.width - SIDE_MARGIN - 28);
  return { placement, top, caretX };
}

/** ¿El bocadillo cabe fuera del hueco (y entonces lleva piquito)? */
export function bubbleOutside(hole: Edges, place: BubblePlacement, bubbleHeight: number): boolean {
  return place.placement === 'below'
    ? place.top >= hole.bottom
    : place.top + bubbleHeight <= hole.top;
}

/** ¿Han cambiado dos medidas lo bastante como para mover el foco? */
export function movedEnough(a: Rect, b: Rect, threshold = 1.5): boolean {
  return (
    Math.abs(a.x - b.x) > threshold ||
    Math.abs(a.y - b.y) > threshold ||
    Math.abs(a.width - b.width) > threshold ||
    Math.abs(a.height - b.height) > threshold
  );
}

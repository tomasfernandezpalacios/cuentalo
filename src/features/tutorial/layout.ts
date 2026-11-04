// Geometría del foco y del bocadillo del tutorial. Funciones puras para poder testearlas.

export type Rect = { x: number; y: number; width: number; height: number };
export type Screen = { width: number; height: number; top: number; bottom: number };

/** Margen alrededor del elemento iluminado. */
export const HOLE_PADDING = 8;
/** Hueco entre el foco y el bocadillo, donde va la flecha. */
export const ARROW_SPACE = 34;
const SIDE_MARGIN = 16;

/** Hueco iluminado: el elemento con un poco de margen y esquinas redondeadas. */
export function holeFor(target: Rect): Rect & { radius: number } {
  const hole = {
    x: target.x - HOLE_PADDING,
    y: target.y - HOLE_PADDING,
    width: target.width + HOLE_PADDING * 2,
    height: target.height + HOLE_PADDING * 2,
  };
  return { ...hole, radius: Math.min(18, hole.height / 2, hole.width / 2) };
}

export type BubblePlacement = {
  placement: 'above' | 'below';
  /** Posición vertical del bocadillo. */
  top: number;
  /** Posición horizontal de la flecha (centro del hueco, sin salirse por los lados). */
  arrowX: number;
  /** Posición vertical de la flecha (en el espacio entre el foco y el bocadillo). */
  arrowY: number;
};

/**
 * Dónde poner el bocadillo: debajo del foco si cabe; si no, encima; si no cabe en ninguno,
 * donde haya más sitio, sin salirse de la zona segura de la pantalla. Nunca tapa el foco
 * mientras quepa en uno de los lados.
 */
export function placeBubble(hole: Rect, bubbleHeight: number, screen: Screen): BubblePlacement {
  const minTop = screen.top + SIDE_MARGIN;
  const maxBottom = screen.height - screen.bottom - SIDE_MARGIN;
  const spaceBelow = maxBottom - (hole.y + hole.height + ARROW_SPACE);
  const spaceAbove = hole.y - ARROW_SPACE - minTop;
  const below =
    spaceBelow >= bubbleHeight || (spaceAbove < bubbleHeight && spaceBelow >= spaceAbove);

  const rawTop = below ? hole.y + hole.height + ARROW_SPACE : hole.y - ARROW_SPACE - bubbleHeight;
  const top = Math.min(Math.max(rawTop, minTop), Math.max(minTop, maxBottom - bubbleHeight));

  const center = hole.x + hole.width / 2;
  const arrowX = Math.min(Math.max(center, SIDE_MARGIN + 12), screen.width - SIDE_MARGIN - 12);
  const arrowY = below ? hole.y + hole.height + 4 : hole.y - ARROW_SPACE + 4;
  return { placement: below ? 'below' : 'above', top, arrowX, arrowY };
}

/** Contorno del oscurecido con un hueco redondeado (para un Path con fillRule evenodd). */
export function dimPath(width: number, height: number, hole: Rect & { radius: number }): string {
  const { x, y, width: w, height: h, radius: r } = hole;
  const outer = `M0 0H${width}V${height}H0Z`;
  const inner =
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}` +
    `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  return `${outer}${inner}`;
}

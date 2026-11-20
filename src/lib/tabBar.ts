/**
 * Forma de la barra de pestañas (en prueba; para volver a la otra basta cambiar esta línea, y la
 * demo del tutorial la sigue también):
 * - 'center': «Mis contadores» va siempre en la bola dorada del centro (crece un poco cuando
 *   estás en ella) y las demás pestañas solo se encienden en dorado y crecen al elegirlas.
 * - 'sliding': la bola va con la pestaña activa y se desliza de una a otra.
 * - 'pill' (de serie, elegida por el usuario el 2026-11-20): un óvalo dorado suave con borde
 *   dorado rodea el icono de la pestaña activa, dentro de la barra (nada sobresale), y se desliza
 *   de una a otra. Con «Mis contadores» a la izquierda, una bola que sobresale rompía la simetría.
 * 'center' y 'mixed' solo tienen sentido con «Mis contadores» en el centro de la barra.
 * - 'mixed' (punto medio): un aro dorado suave marca siempre «Mis contadores» en el
 *   centro y la bola dorada se desliza a la pestaña activa; en el centro es grande y tapa el aro,
 *   en las demás encoge para caber en la barra.
 */
export const TAB_BALL_MODE: 'center' | 'sliding' | 'mixed' | 'pill' = 'pill';

/** Alto de la barra sin contar la zona segura de abajo del móvil (que la barra también cubre). */
export const TAB_BAR_HEIGHT = 63;
/** Cuánto sube el centro de la bola sobre el centro de la barra: sobresale bien por arriba. */
export const TAB_BALL_RISE = 15;
/** Medidas del óvalo de la forma 'pill': ancho máximo y alto (cabe dentro de la barra). */
export const TAB_PILL_WIDTH = 76;
export const TAB_PILL_HEIGHT = 46;

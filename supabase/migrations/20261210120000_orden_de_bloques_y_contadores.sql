-- Orden personal de la pantalla de Estadísticas y de «Mis contadores» (petición del usuario: se
-- reordenan manteniendo pulsado y arrastrando). Va en la tabla privada de la cuenta, así es el
-- mismo en cualquier móvil y nadie más lo ve.
--
-- * stats_blocks: bloques de Estadísticas en su orden ('chart', 'streak', 'age'). null = el de
--   siempre (gráfica y racha). 'age' solo está si se añadió desde el Resumen vital.
-- * counter_order: ids de mis contadores en el orden en que los quiero ver. Los que no están
--   (p. ej. uno nuevo) van al final, por fecha de creación.

alter table public.profile_private
  add column stats_blocks text[],
  add column counter_order uuid[];

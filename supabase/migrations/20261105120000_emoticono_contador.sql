-- Emoticono opcional que identifica cada contador (petición del usuario).
-- char_length cuenta puntos de código: algunos emoticonos compuestos (familias, banderas, tonos
-- de piel) usan varios, por eso el límite es 10 y no 1.

alter table public.counters
  add column emoji text check (emoji is null or char_length(emoji) between 1 and 10);

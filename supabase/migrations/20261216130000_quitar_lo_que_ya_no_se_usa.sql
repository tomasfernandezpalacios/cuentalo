-- Se borra lo que la app dejó de usar con la migración 20261216120000 (aplicar cuando la app
-- nueva ya esté en main):
--  * undo_last_entry: el usuario no quiere «Deshacer» tras un −1.
--  * get_group_counter_daily: sustituida por get_group_counter_days (JSON, sin el límite de 1000).
--  * Vista entry_daily_totals: sustituida por get_my_daily_totals (una sola petición).
--  * Vista counter_totals: el detalle suelto usa my_counter_totals() (sin una función por fila).

drop function if exists public.undo_last_entry(uuid);
drop function if exists public.get_group_counter_daily(uuid);
drop view if exists public.entry_daily_totals;
drop view if exists public.counter_totals;

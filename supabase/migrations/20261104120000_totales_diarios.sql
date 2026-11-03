-- Fase 2: totales diarios para las estadísticas.
-- Agrupa los registros por contador, usuario y día natural en Europe/Madrid. La app suma estos
-- días en semanas, meses y años, así descarga pocas filas aunque haya miles de registros.

create view public.entry_daily_totals
with (security_invoker = true)
as
select
  e.counter_id,
  e.user_id,
  (e.logged_at at time zone 'Europe/Madrid')::date as day,
  sum(e.amount) as total,
  count(*)::int as entry_count
from public.entries e
group by e.counter_id, e.user_id, (e.logged_at at time zone 'Europe/Madrid')::date;

comment on view public.entry_daily_totals is
  'Totales por contador, usuario y día (Europe/Madrid). Respeta la RLS de entries.';

revoke all on public.entry_daily_totals from anon, authenticated;
grant select on public.entry_daily_totals to authenticated;

-- Contadores en formato racha (petición del usuario), p. ej. «días sin fumar».
--
-- Usa la columna counters.streak_enabled (ya existía, sin uso). El contador funciona como uno
-- normal, pero lo que se muestra es la RACHA ACTUAL: la suma de lo registrado en los días
-- seguidos (hora de Madrid) que terminan hoy o ayer. Si pasa un día entero sin registrar, la
-- racha vuelve a 0. Igual que la racha general, la de ayer sigue viva hasta que acabe hoy.
--
-- No se borra nada: el historial y las estadísticas conservan todo, y se guarda el récord
-- (la mejor racha). En los de grupo, cada miembro tiene su propia racha y la clasificación
-- compara las rachas actuales.
--
-- Las rachas se calculan con «huecos e islas» (como en rachas_de_amigos): en días seguidos,
-- día − número de fila es constante, así que agrupando por esa diferencia salen las rachas.

-- Mis rachas por contador. security_invoker: la RLS de entries decide qué se ve, y solo se
-- miran mis registros (sin las copias para otros grupos de un contador enlazado).
create view public.my_counter_streaks
with (security_invoker = true) as
with days as (
  select e.counter_id,
         (e.logged_at at time zone 'Europe/Madrid')::date as day,
         sum(e.amount) as amount
    from public.entries e
    join public.counters c on c.id = e.counter_id
   where c.streak_enabled
     and e.user_id = (select auth.uid())
     and not e.group_only
   group by e.counter_id, (e.logged_at at time zone 'Europe/Madrid')::date
),
islands as (
  select d.counter_id, d.day, d.amount,
         d.day - (row_number() over (partition by d.counter_id order by d.day))::int as grp
    from days d
),
runs as (
  select i.counter_id, max(i.day) as end_day, sum(i.amount) as total, count(*)::int as days
    from islands i
   group by i.counter_id, i.grp
),
today as (
  select (now() at time zone 'Europe/Madrid')::date as d
)
select
  r.counter_id,
  coalesce(max(r.total) filter (where r.end_day >= t.d - 1), 0) as current_total,
  coalesce(max(r.days) filter (where r.end_day >= t.d - 1), 0) as current_days,
  max(r.total) as best_total,
  max(r.days) as best_days
from runs r
cross join today t
group by r.counter_id;

grant select on public.my_counter_streaks to authenticated;

-- Clasificación de un contador de grupo en formato racha: la racha actual de cada miembro
-- activo (sin registros solo personales, como la clasificación normal) y su récord.
create function public.get_streak_leaderboard(p_counter_id uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  total numeric,
  best numeric,
  "position" int
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  select c.group_id into v_group_id from public.counters c where c.id = p_counter_id;
  if v_group_id is null or not public.is_group_member(v_group_id) then
    raise exception 'not_shared_counter';
  end if;

  return query
  with days as (
    select e.user_id,
           (e.logged_at at time zone 'Europe/Madrid')::date as day,
           sum(e.amount) as amount
      from public.entries e
     where e.counter_id = p_counter_id and not e.personal_only
     group by e.user_id, (e.logged_at at time zone 'Europe/Madrid')::date
  ),
  islands as (
    select d.user_id, d.day, d.amount,
           d.day - (row_number() over (partition by d.user_id order by d.day))::int as grp
      from days d
  ),
  runs as (
    select i.user_id, max(i.day) as end_day, sum(i.amount) as total
      from islands i
     group by i.user_id, i.grp
  ),
  today as (
    select (now() at time zone 'Europe/Madrid')::date as d
  ),
  per_user as (
    select r.user_id,
           coalesce(max(r.total) filter (where r.end_day >= t.d - 1), 0) as current_total,
           max(r.total) as best_total
      from runs r cross join today t
     group by r.user_id
  )
  select
    m.user_id,
    p.username,
    p.display_name,
    coalesce(u.current_total, 0),
    coalesce(u.best_total, 0),
    (rank() over (order by coalesce(u.current_total, 0) desc))::int
  from public.group_members m
  join public.profiles p on p.id = m.user_id
  left join per_user u on u.user_id = m.user_id
  where m.group_id = v_group_id and m.status = 'active'
  order by 6, 3;
end;
$$;

revoke execute on function public.get_streak_leaderboard(uuid) from public, anon;
grant execute on function public.get_streak_leaderboard(uuid) to authenticated;

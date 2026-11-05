-- Cambios en las rachas (petición del usuario).
--
-- 1. Contadores en formato racha: el contador ya NO vuelve a 0. Cuenta como uno normal y,
--    además, lleva una racha propia: días seguidos (hora de Madrid) en los que lo sumado en
--    el día es +1 o más. Si un día no se llega (p. ej. «días sin fumar» y ese día se fuma),
--    la racha vuelve a 0 pero el contador no. Igual que siempre, la racha de ayer sigue viva
--    hasta que acabe hoy. La racha y el récord se miden en DÍAS.
-- 2. Todas las rachas dicen si hoy ya se ha mantenido (para pintar la llama en color o en
--    gris): today_done en my_counter_streaks y active_today en get_friends_streaks.

create or replace view public.my_counter_streaks
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
good_days as (
  -- Solo cuentan los días que acaban en +1 o más.
  select d.counter_id, d.day from days d where d.amount >= 1
),
islands as (
  select g.counter_id, g.day,
         g.day - (row_number() over (partition by g.counter_id order by g.day))::int as grp
    from good_days g
),
runs as (
  select i.counter_id, max(i.day) as end_day, count(*)::int as days
    from islands i
   group by i.counter_id, i.grp
),
today as (
  select (now() at time zone 'Europe/Madrid')::date as d
)
select
  r.counter_id,
  coalesce(max(r.days) filter (where r.end_day >= t.d - 1), 0)::numeric as current_total,
  coalesce(max(r.days) filter (where r.end_day >= t.d - 1), 0) as current_days,
  max(r.days)::numeric as best_total,
  max(r.days) as best_days,
  bool_or(r.end_day = t.d) as today_done
from runs r
cross join today t
group by r.counter_id;

-- Clasificación de racha de un contador de grupo: ahora en días seguidos con +1 o más.
create or replace function public.get_streak_leaderboard(p_counter_id uuid)
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
    select d.user_id, d.day,
           d.day - (row_number() over (partition by d.user_id order by d.day))::int as grp
      from days d
     where d.amount >= 1
  ),
  runs as (
    select i.user_id, max(i.day) as end_day, count(*)::int as days
      from islands i
     group by i.user_id, i.grp
  ),
  today as (
    select (now() at time zone 'Europe/Madrid')::date as d
  ),
  per_user as (
    select r.user_id,
           coalesce(max(r.days) filter (where r.end_day >= t.d - 1), 0) as current_days,
           max(r.days) as best_days
      from runs r cross join today t
     group by r.user_id
  )
  select
    m.user_id,
    p.username,
    p.display_name,
    coalesce(u.current_days, 0)::numeric,
    coalesce(u.best_days, 0)::numeric,
    (rank() over (order by coalesce(u.current_days, 0) desc))::int
  from public.group_members m
  join public.profiles p on p.id = m.user_id
  left join per_user u on u.user_id = m.user_id
  where m.group_id = v_group_id and m.status = 'active'
  order by 6, 3;
end;
$$;

-- Racha de uso de amigos: añade si hoy ya han registrado algo (cambia lo que devuelve, así que
-- hay que borrarla y crearla de nuevo; se mantiene lo de ocultar la racha).
drop function public.get_friends_streaks();

create function public.get_friends_streaks()
returns table (
  user_id uuid,
  username text,
  display_name text,
  current_streak int,
  best_streak int,
  active_today boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as id
  ),
  people as (
    select id from me where id is not null
    union
    select case when f.requester_id = me.id then f.addressee_id else f.requester_id end
      from public.friendships f, me
     where f.status = 'accepted' and me.id in (f.requester_id, f.addressee_id)
       -- Quien oculta su racha no sale en la de sus amigos (pero sí se ve a sí mismo).
       and not (
         select pr.hide_streak from public.profiles pr
          where pr.id = case when f.requester_id = me.id then f.addressee_id else f.requester_id end
       )
  ),
  islands as (
    select a.user_id, a.day,
           a.day - (row_number() over (partition by a.user_id order by a.day))::int as grp
      from public.user_activity_days a
     where a.user_id in (select id from people)
  ),
  runs as (
    select i.user_id, max(i.day) as end_day, count(*)::int as len
      from islands i
     group by i.user_id, i.grp
  ),
  today as (
    select (now() at time zone 'Europe/Madrid')::date as d
  )
  select
    p.id,
    pr.username,
    pr.display_name,
    coalesce((
      select r.len from runs r, today
       where r.user_id = p.id and r.end_day >= today.d - 1
       order by r.end_day desc
       limit 1
    ), 0) as current_streak,
    coalesce((select max(r.len) from runs r where r.user_id = p.id), 0) as best_streak,
    exists (
      select 1 from public.user_activity_days a, today
       where a.user_id = p.id and a.day = today.d
    ) as active_today
  from people p
  join public.profiles pr on pr.id = p.id;
$$;

revoke execute on function public.get_friends_streaks() from public, anon;
grant execute on function public.get_friends_streaks() to authenticated;

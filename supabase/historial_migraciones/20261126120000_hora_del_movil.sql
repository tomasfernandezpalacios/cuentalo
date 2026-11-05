-- Hora del móvil en vez de la de Madrid (petición del usuario).
--
-- Hasta ahora los días (rachas, estadísticas, clasificaciones) se contaban en Europe/Madrid.
-- Ahora cada usuario guarda su zona horaria (la del móvil, que la app actualiza al abrirse) y
-- todo se calcula en la zona de quien mira (o de quien registra, para el día de actividad).
-- Si alguien no tiene zona guardada, se sigue usando Europe/Madrid.
--
-- También se cambian los textos de error de la administración del grupo: el del grupo es ahora
-- el «líder» (el «administrador» es el de cada contador).

alter table public.profiles add column time_zone text not null default 'Europe/Madrid';

-- Mi zona horaria (o Madrid si no hay sesión o perfil).
create function public.my_time_zone()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.time_zone from public.profiles p where p.id = (select auth.uid())),
    'Europe/Madrid'
  );
$$;

grant execute on function public.my_time_zone() to authenticated;

-- La app guarda la zona del móvil. Solo se aceptan zonas que Postgres conoce (si no, fallaría
-- «at time zone»), por eso va por esta función y no con un update directo.
create function public.set_my_time_zone(p_time_zone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then
    raise exception 'Zona horaria no válida: %', p_time_zone;
  end if;
  update public.profiles set time_zone = p_time_zone where id = (select auth.uid());
end;
$$;

revoke execute on function public.set_my_time_zone(text) from public, anon;
grant execute on function public.set_my_time_zone(text) to authenticated;

-- Totales diarios (Estadísticas).
create or replace view public.entry_daily_totals
with (security_invoker = true)
as
select
  e.counter_id,
  e.user_id,
  (e.logged_at at time zone public.my_time_zone())::date as day,
  sum(e.amount) as total,
  (count(*) filter (where e.amount > 0))::int as entry_count
from public.entries e
where not e.group_only
group by e.counter_id, e.user_id, (e.logged_at at time zone public.my_time_zone())::date;

-- Clasificación por periodo: la semana/mes/año naturales de quien mira.
create or replace function public.get_leaderboard(counter_id uuid, period text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  total numeric,
  entry_count int,
  "position" int
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_start timestamp;
begin
  if period not in ('week', 'month', 'year', 'all') then
    raise exception 'invalid_period';
  end if;

  select c.group_id into v_group_id from public.counters c where c.id = get_leaderboard.counter_id;
  if v_group_id is null or not public.is_group_member(v_group_id) then
    raise exception 'not_shared_counter';
  end if;

  if period <> 'all' then
    v_start := date_trunc(period, now() at time zone public.my_time_zone());
  end if;

  return query
  select
    m.user_id,
    p.username,
    p.display_name,
    coalesce(sum(e.amount), 0) as total,
    (count(e.id) filter (where e.amount > 0))::int as entry_count,
    (rank() over (order by coalesce(sum(e.amount), 0) desc))::int as "position"
  from public.group_members m
  join public.profiles p on p.id = m.user_id
  left join public.entries e
    on e.counter_id = get_leaderboard.counter_id
   and e.user_id = m.user_id
   and not e.personal_only
   and (v_start is null or (e.logged_at at time zone public.my_time_zone()) >= v_start)
  where m.group_id = v_group_id and m.status = 'active'
  group by m.user_id, p.username, p.display_name
  order by 6, 3;
end;
$$;

-- Día de actividad (racha de uso): el día de quien pulsa, en su hora.
create or replace function public.track_activity_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_activity_days (user_id, day)
  values (
    coalesce((select auth.uid()), new.user_id),
    (now() at time zone public.my_time_zone())::date
  )
  on conflict do nothing;
  return null;
end;
$$;

-- Rachas de amigos: «hoy» es el de quien mira.
create or replace function public.get_friends_streaks()
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
    select (now() at time zone public.my_time_zone())::date as d
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

-- Rachas de mis contadores.
create or replace view public.my_counter_streaks
with (security_invoker = true) as
with days as (
  select e.counter_id,
         (e.logged_at at time zone public.my_time_zone())::date as day,
         sum(e.amount) as amount
    from public.entries e
    join public.counters c on c.id = e.counter_id
   where c.streak_enabled
     and e.user_id = (select auth.uid())
     and not e.group_only
   group by e.counter_id, (e.logged_at at time zone public.my_time_zone())::date
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
  select (now() at time zone public.my_time_zone())::date as d
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

-- Rachas de un contador de grupo.
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
           (e.logged_at at time zone public.my_time_zone())::date as day,
           sum(e.amount) as amount
      from public.entries e
     where e.counter_id = p_counter_id and not e.personal_only
     group by e.user_id, (e.logged_at at time zone public.my_time_zone())::date
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
    select (now() at time zone public.my_time_zone())::date as d
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

-- Gráfica del grupo.
create or replace function public.get_group_counter_daily(p_counter_id uuid)
returns table (user_id uuid, day date, total numeric)
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
  select e.user_id,
         (e.logged_at at time zone public.my_time_zone())::date,
         sum(e.amount)
    from public.entries e
    join public.group_members m
      on m.group_id = v_group_id and m.user_id = e.user_id and m.status = 'active'
   where e.counter_id = p_counter_id and not e.personal_only
   group by e.user_id, (e.logged_at at time zone public.my_time_zone())::date
   order by 2;
end;
$$;

-- Textos de error con «líder».

create or replace function public.transfer_group_admin(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Solo el líder puede designar a otro.';
  end if;
  if p_user_id = (select auth.uid()) or not exists (
    select 1 from public.group_members
     where group_id = p_group_id and user_id = p_user_id and status = 'active'
  ) then
    raise exception 'Esa persona no es miembro activo del grupo.';
  end if;
  perform public.set_group_admin(p_group_id, p_user_id);
end;
$$;

create or replace function public.resign_group_admin(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_successor uuid;
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'No eres el líder de este grupo.';
  end if;
  v_successor := public.random_group_member(p_group_id, (select auth.uid()));
  if v_successor is null then
    raise exception 'Eres el único miembro del grupo: no hay nadie a quien pasarle el liderazgo.';
  end if;
  perform public.set_group_admin(p_group_id, v_successor);
  return v_successor;
end;
$$;

create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_successor uuid;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'No eres miembro de este grupo.';
  end if;
  if public.is_group_owner(p_group_id) then
    v_successor := public.random_group_member(p_group_id, v_me);
    if v_successor is null then
      raise exception 'Eres el único miembro del grupo: si quieres irte, elimínalo.';
    end if;
    perform public.set_group_admin(p_group_id, v_successor);
  end if;
  delete from public.group_members where group_id = p_group_id and user_id = v_me;
end;
$$;

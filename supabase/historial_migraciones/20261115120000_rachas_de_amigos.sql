-- Rachas de amigos (petición del usuario): clasificación de rachas entre mis amigos y yo.
--
-- Los días de actividad siguen siendo privados (user_activity_days solo lo lee su dueño). Esta
-- función SECURITY DEFINER solo devuelve, para mí y mis amigos ACEPTADOS, el número de la racha
-- actual y la mejor; nunca los días.
--
-- Misma regla que la app: la racha sigue viva si su último día es hoy o ayer (hora de Madrid).
-- Las rachas se calculan con la técnica de «huecos e islas»: en días consecutivos,
-- día − número de fila es constante, así que agrupando por esa diferencia salen las rachas.

create function public.get_friends_streaks()
returns table (
  user_id uuid,
  username text,
  display_name text,
  current_streak int,
  best_streak int
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
    coalesce((select max(r.len) from runs r where r.user_id = p.id), 0) as best_streak
  from people p
  join public.profiles pr on pr.id = p.id;
$$;

revoke execute on function public.get_friends_streaks() from public, anon;
grant execute on function public.get_friends_streaks() to authenticated;

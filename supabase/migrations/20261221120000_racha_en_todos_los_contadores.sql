-- Todos los contadores tienen racha (petición del usuario, 2026-11-19). Desaparece el «Formato
-- racha» (counters.streak_enabled): la racha de cada contador son los días seguidos en los que
-- lo que sumo ese día es +1 o más, igual que antes en los de formato racha. Cada uno decide, por
-- contador, si la ve junto al nombre en «Mis contadores» («Mostrar racha», desmarcado de serie):
-- tabla personal shown_counter_streaks, como hidden_counters. En el detalle sale siempre.

create table public.shown_counter_streaks (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  counter_id uuid not null references public.counters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, counter_id)
);
create index shown_counter_streaks_counter_idx on public.shown_counter_streaks (counter_id);

alter table public.shown_counter_streaks enable row level security;
revoke all on public.shown_counter_streaks from public, anon, authenticated;
grant select, insert, delete on public.shown_counter_streaks to authenticated;

create policy "shown_counter_streaks: cada uno los suyos"
  on public.shown_counter_streaks for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Quien ya veía la racha de un contador de formato racha la sigue viendo: el dueño de los
-- individuales y los miembros activos de los de grupo.
insert into public.shown_counter_streaks (user_id, counter_id)
select c.owner_id, c.id
  from public.counters c
 where c.streak_enabled and c.group_id is null
union
select m.user_id, c.id
  from public.counters c
  join public.group_members m on m.group_id = c.group_id and m.status = 'active'
 where c.streak_enabled and c.group_id is not null
on conflict do nothing;

-- La racha se calcula para todos mis contadores (antes solo los de formato racha).
create or replace view public.my_counter_streaks
with (security_invoker = true) as
with tz as (
  select public.my_time_zone() as tz
),
mine as materialized (
  select e.counter_id, e.logged_at, e.amount
    from public.entries e
   where e.user_id = (select auth.uid())
     and not e.group_only
),
days as (
  select m.counter_id,
         (m.logged_at at time zone tz.tz)::date as day,
         sum(m.amount) as amount
    from mine m
    cross join tz
   group by 1, 2
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
  select (now() at time zone tz.tz)::date as d from tz
)
select
  r.counter_id,
  coalesce(max(r.days) filter (where r.end_day >= t.d - 1), 0)::numeric as current_total,
  coalesce(max(r.days) filter (where r.end_day >= t.d - 1), 0) as current_days,
  max(r.days)::numeric as best_total,
  max(r.days) as best_days,
  bool_or(r.end_day = t.d) as today_done,
  -- Lo que llevo sumado hoy (para avisar si un −1 rompería la racha).
  coalesce(max(td.amount), 0) as today_amount
from runs r
cross join today t
left join days td on td.counter_id = r.counter_id and td.day = t.d
group by r.counter_id;

alter table public.counters drop column streak_enabled;

-- La carga de «Mis contadores» trae también en qué contadores quiero ver la racha.
create or replace function public.get_my_home()
returns json
language sql
stable
set search_path = ''
as $$
  with visible as (select public.my_visible_counter_ids() as id)
  select json_build_object(
    'counters', coalesce((
      select json_agg(c order by c.created_at)
        from public.counters c
       where c.id in (select id from visible)
    ), '[]'::json),
    'totals', coalesce((
      select json_agg(t) from public.my_counter_totals() t
    ), '[]'::json),
    'groups', coalesce((
      select json_agg(json_build_object(
        'id', g.id, 'name', g.name, 'owner_id', g.owner_id,
        'emoji', g.emoji, 'photo_path', g.photo_path
      ))
        from public.group_members m
        join public.groups g on g.id = m.group_id
       where m.user_id = (select auth.uid()) and m.status = 'active'
    ), '[]'::json),
    'participants', coalesce((
      select json_agg(json_build_object('counter_id', p.counter_id, 'user_id', p.user_id))
        from public.counter_participants p
       where p.counter_id in (select id from visible)
    ), '[]'::json),
    'aliases', coalesce((
      select json_agg(json_build_object('counter_id', a.counter_id, 'name', a.name, 'emoji', a.emoji))
        from public.counter_aliases a
       where a.user_id = (select auth.uid())
    ), '[]'::json),
    'links', coalesce((
      select json_agg(json_build_object(
        'counter_id', l.counter_id, 'link_id', l.link_id, 'is_primary', l.is_primary
      ))
        from public.counter_links l
       where l.user_id = (select auth.uid())
    ), '[]'::json),
    'hidden', coalesce((
      select json_agg(h.counter_id)
        from public.hidden_counters h
       where h.user_id = (select auth.uid())
    ), '[]'::json),
    'removed', coalesce((
      select json_agg(r.counter_id)
        from public.home_removed_counters r
       where r.user_id = (select auth.uid())
    ), '[]'::json),
    'streaks', coalesce((
      select json_agg(s) from public.my_counter_streaks s
    ), '[]'::json),
    'streak_shown', coalesce((
      select json_agg(s.counter_id)
        from public.shown_counter_streaks s
       where s.user_id = (select auth.uid())
    ), '[]'::json)
  );
$$;

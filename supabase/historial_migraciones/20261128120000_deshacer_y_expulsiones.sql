-- Mejoras pedidas por el usuario.
--
-- 1. Deshacer el último registro: undo_last_entry borra lo último que acabo de apuntar en un
--    contador (como mucho de hace 2 minutos): mi registro y sus copias en contadores enlazados
--    (mismo batch_id) o, en un contador común del que soy administrador, la tanda que sumé a
--    todos (mismas filas insertadas a la vez).
-- 2. my_counter_streaks añade today_amount (lo sumado hoy) para avisar si un −1 rompería la
--    racha de un contador de racha.
-- 3. Aviso al ser expulsado de un grupo («kicked»): un trigger lo envía cuando el líder borra
--    la fila de un miembro activo. No avisa al salir uno mismo, al retirar una invitación ni
--    cuando se borra el grupo entero (eso ya tiene su aviso).

create function public.undo_last_entry(p_counter_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_entry record;
  v_created timestamptz;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  -- Contador común del que soy administrador: la última tanda que sumé a todos.
  if exists (select 1 from public.counters c where c.id = p_counter_id and c.is_common)
     and public.can_log_common(p_counter_id) then
    select max(e.created_at) into v_created
      from public.entries e
     where e.counter_id = p_counter_id and e.created_at >= now() - interval '2 minutes';
    if v_created is null then
      return false;
    end if;
    delete from public.entries e
     where e.counter_id = p_counter_id and e.created_at = v_created;
    return true;
  end if;

  -- Si no: mi último registro en el contador (con sus copias enlazadas).
  select e.id, e.batch_id into v_entry
    from public.entries e
   where e.counter_id = p_counter_id
     and e.user_id = v_me
     and e.created_at >= now() - interval '2 minutes'
   order by e.created_at desc
   limit 1;
  if v_entry.id is null then
    return false;
  end if;
  if v_entry.batch_id is not null then
    delete from public.entries e where e.batch_id = v_entry.batch_id and e.user_id = v_me;
  else
    delete from public.entries e where e.id = v_entry.id;
  end if;
  return true;
end;
$$;

revoke execute on function public.undo_last_entry(uuid) from public, anon;
grant execute on function public.undo_last_entry(uuid) to authenticated;

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
  bool_or(r.end_day = t.d) as today_done,
  -- Lo que llevo sumado hoy (para avisar si un −1 rompería la racha).
  coalesce(max(td.amount), 0) as today_amount
from runs r
cross join today t
left join days td on td.counter_id = r.counter_id and td.day = t.d
group by r.counter_id;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'friend_accepted', 'request_approved', 'request_rejected', 'counter_deleted', 'group_deleted',
  'group_admin', 'member_left', 'new_leader', 'you_are_leader', 'kicked'
));

create function public.notify_kicked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_name text;
begin
  -- Solo si lo ha quitado otro (el líder), era miembro activo y el grupo sigue existiendo.
  if old.status <> 'active' or (select auth.uid()) is null
     or (select auth.uid()) = old.user_id then
    return null;
  end if;
  select g.name into v_group_name from public.groups g where g.id = old.group_id;
  if v_group_name is null then
    return null;
  end if;
  insert into public.notifications (user_id, kind, actor_id, actor_name, group_name)
  select old.user_id, 'kicked', p.id, p.display_name, v_group_name
    from public.profiles p
   where p.id = (select auth.uid());
  return null;
end;
$$;

create trigger on_group_member_kicked
  after delete on public.group_members
  for each row execute function public.notify_kicked();

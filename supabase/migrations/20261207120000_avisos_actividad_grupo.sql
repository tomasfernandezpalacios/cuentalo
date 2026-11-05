-- Avisos de actividad en los contadores de grupo (petición del usuario).
--
-- Cuando alguien suma o resta en un contador de grupo, los demás miembros activos reciben UN
-- aviso con el total neto de lo que ha hecho («Ana ha sumado +6 en «Cafés» (Gimnasio)»), no uno
-- por toque. Se agrupa en la base de datos (así funciona aunque se cierre la app):
--
-- * Cada cambio (+N, −1, deshacer, editar) suma su cantidad a un aviso «pendiente» por miembro
--   (mismo contador y misma persona) y lo retrasa: visible_from = ahora + 20 s.
-- * Mientras está pendiente (visible_from en el futuro), la RLS no lo enseña ni deja marcarlo
--   como leído. A los 20 s del último cambio aparece en el buzón.
-- * Si el neto queda en 0 (p. ej. +1 y −1), no se enseña.
--
-- No cuenta lo que solo es personal (personal_only) ni los contadores comunes (allí ya están las
-- solicitudes al administrador). Solo avisa si quien registra es miembro activo del grupo (así,
-- al borrar una cuenta o dejar un grupo no llegan avisos de «ha restado»).

alter table public.notifications
  add column counter_id uuid references public.counters (id) on delete cascade,
  add column visible_from timestamptz not null default now();

create index notifications_pending_idx on public.notifications (counter_id, actor_id, visible_from)
  where kind = 'group_activity';
create index notifications_counter_idx on public.notifications (counter_id);

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'friend_accepted', 'friend_you_accepted', 'request_approved', 'request_rejected',
  'counter_deleted', 'group_deleted', 'group_admin', 'member_left', 'new_leader',
  'you_are_leader', 'kicked', 'group_activity'
));

-- Suma p_amount al aviso pendiente de cada miembro (o lo crea) y lo retrasa 20 s.
create or replace function public.group_activity_bump(
  p_counter_id uuid,
  p_actor uuid,
  p_amount numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group uuid;
  v_common boolean;
  v_counter_name text;
  v_group_name text;
  v_actor_name text;
  v_until timestamptz := now() + interval '20 seconds';
begin
  if p_amount = 0 then
    return;
  end if;
  select c.group_id, c.is_common, c.name into v_group, v_common, v_counter_name
    from public.counters c where c.id = p_counter_id;
  if v_group is null or v_common then
    return;
  end if;
  if not exists (
    select 1 from public.group_members m
     where m.group_id = v_group and m.user_id = p_actor and m.status = 'active'
  ) then
    return;
  end if;
  select g.name into v_group_name from public.groups g where g.id = v_group;
  select p.display_name into v_actor_name from public.profiles p where p.id = p_actor;

  -- Los que ya tienen uno pendiente: se acumula y se retrasa.
  update public.notifications n
     set amount = n.amount + p_amount, visible_from = v_until, created_at = now()
   where n.kind = 'group_activity'
     and n.counter_id = p_counter_id
     and n.actor_id = p_actor
     and n.visible_from > now();

  -- El resto de miembros activos: uno nuevo.
  insert into public.notifications
    (user_id, kind, actor_id, actor_name, counter_id, counter_name, group_name, amount, visible_from)
  select m.user_id, 'group_activity', p_actor, v_actor_name, p_counter_id, v_counter_name,
         v_group_name, p_amount, v_until
    from public.group_members m
   where m.group_id = v_group
     and m.status = 'active'
     and m.user_id <> p_actor
     and not exists (
       select 1 from public.notifications n
        where n.user_id = m.user_id
          and n.kind = 'group_activity'
          and n.counter_id = p_counter_id
          and n.actor_id = p_actor
          and n.visible_from > now()
     );
end;
$$;

create or replace function public.on_entry_group_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not new.personal_only then
      perform public.group_activity_bump(new.counter_id, new.user_id, new.amount);
    end if;
  elsif tg_op = 'DELETE' then
    if not old.personal_only then
      perform public.group_activity_bump(old.counter_id, old.user_id, -old.amount);
    end if;
  elsif new.counter_id = old.counter_id and not new.personal_only and new.amount <> old.amount then
    perform public.group_activity_bump(new.counter_id, new.user_id, new.amount - old.amount);
  end if;
  return null;
end;
$$;

create trigger on_entry_group_activity
  after insert or update or delete on public.entries
  for each row execute function public.on_entry_group_activity();

revoke execute on function
  public.group_activity_bump(uuid, uuid, numeric),
  public.on_entry_group_activity()
from public, anon, authenticated;

-- Los pendientes (y los que se han quedado en 0) no se ven ni se marcan como leídos.
drop policy "notifications: cada uno las suyas" on public.notifications;
create policy "notifications: cada uno las suyas"
  on public.notifications for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and visible_from <= now()
    and not (kind = 'group_activity' and amount = 0)
  );

drop policy "notifications: cada uno marca las suyas como leídas" on public.notifications;
create policy "notifications: cada uno marca las suyas como leídas"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()) and visible_from <= now())
  with check (user_id = (select auth.uid()));

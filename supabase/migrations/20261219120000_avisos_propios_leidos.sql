-- Avisos: el de tus propias sumas en un grupo («Has sumado…») nace leído (petición del usuario,
-- 2026-11-18: el punto rojo salía por algo que habías hecho tú). Los que ya había, leídos.
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

  update public.notifications n
     set amount = n.amount + p_amount, visible_from = v_until, created_at = now()
   where n.kind = 'group_activity'
     and n.counter_id = p_counter_id
     and n.actor_id = p_actor
     and n.visible_from > now();

  -- El aviso de quien suma («Has sumado…») nace leído: está en su lista, pero no enciende el
  -- punto rojo (migración 20261219120000).
  insert into public.notifications
    (user_id, kind, actor_id, actor_name, counter_id, counter_name, group_name, amount,
     visible_from, read_at)
  select m.user_id, 'group_activity', p_actor, v_actor_name, p_counter_id, v_counter_name,
         v_group_name, p_amount, v_until, case when m.user_id = p_actor then now() end
    from public.group_members m
   where m.group_id = v_group
     and m.status = 'active'
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

update public.notifications
   set read_at = now()
 where kind = 'group_activity'
   and actor_id = user_id
   and read_at is null;

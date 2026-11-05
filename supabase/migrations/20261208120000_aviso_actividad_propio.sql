-- El aviso de actividad en grupo también le llega a quien hace los cambios (petición del
-- usuario): «Has sumado +6 en «Cafés» (Gimnasio)». Igual que a los demás: el neto, 20 s después
-- del último cambio. Solo cambia que entre los destinatarios ya no se excluye a quien registra.

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

  insert into public.notifications
    (user_id, kind, actor_id, actor_name, counter_id, counter_name, group_name, amount, visible_from)
  select m.user_id, 'group_activity', p_actor, v_actor_name, p_counter_id, v_counter_name,
         v_group_name, p_amount, v_until
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

revoke execute on function public.group_activity_bump(uuid, uuid, numeric) from public, anon, authenticated;

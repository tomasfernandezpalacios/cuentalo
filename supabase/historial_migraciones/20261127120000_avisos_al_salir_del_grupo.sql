-- 1. Se quita «Ocultar mis contadores» de Configuración (se pisaba con «Privado» / «Privado y
--    amigos» de cada contador). Se desactiva para todos y ya no se puede cambiar; la columna
--    se queda (get_user_counters la sigue mirando, pero siempre vale false).
--
-- 2. Avisos al salir de un grupo (petición del usuario). Cuando alguien abandona un grupo (o
--    elimina su cuenta), los demás miembros reciben «X ha abandonado el grupo». Si era el
--    líder, el nuevo líder recibe «Eres el nuevo líder del grupo» y los demás «Y es el nuevo
--    líder del grupo». Al salir el líder, el nuevo se elige al azar; al eliminar la cuenta, es
--    el miembro más antiguo (como hasta ahora).
--
--    Se guarda también el nombre de quien sale (actor_name): si eliminó su cuenta, su perfil ya
--    no existe y el aviso tiene que poder decir quién era.

update public.profiles set hide_counters_from_friends = false where hide_counters_from_friends;
revoke update (hide_counters_from_friends) on public.profiles from authenticated;

alter table public.notifications add column actor_name text;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'friend_accepted', 'request_approved', 'request_rejected', 'counter_deleted', 'group_deleted',
  'group_admin', 'member_left', 'new_leader', 'you_are_leader'
));

-- Avisa a los miembros activos de un grupo, salvo a los de p_except.
create function public.notify_group_members(
  p_group_id uuid,
  p_kind text,
  p_actor uuid,
  p_except uuid[]
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, actor_id, actor_name, group_name)
  select m.user_id, p_kind, p_actor, p.display_name, g.name
    from public.group_members m
    join public.groups g on g.id = m.group_id
    left join public.profiles p on p.id = p_actor
   where m.group_id = p_group_id
     and m.status = 'active'
     and m.user_id <> all (p_except);
$$;

revoke execute on function public.notify_group_members(uuid, text, uuid, uuid[])
  from public, anon, authenticated;

-- Quien sale (p_user) deja el grupo: si era el líder, pasa a p_successor con sus avisos; luego
-- se avisa a los demás de que ha salido y se borra su fila. Sin comprobar permisos: lo hacen
-- leave_group y delete_my_account.
create function public.leave_group_as(p_group_id uuid, p_user uuid, p_successor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_successor is not null then
    update public.groups set owner_id = p_successor where id = p_group_id;
    update public.group_members set role = 'member'
     where group_id = p_group_id and user_id = p_user;
    update public.group_members set role = 'owner'
     where group_id = p_group_id and user_id = p_successor;
    -- Al nuevo líder: «Eres el nuevo líder». A los demás: «Y es el nuevo líder».
    insert into public.notifications (user_id, kind, actor_id, actor_name, group_name)
    select p_successor, 'you_are_leader', p_user, p.display_name, g.name
      from public.groups g
      left join public.profiles p on p.id = p_user
     where g.id = p_group_id;
    perform public.notify_group_members(p_group_id, 'new_leader', p_successor,
      array[p_user, p_successor]);
  end if;

  perform public.notify_group_members(p_group_id, 'member_left', p_user, array[p_user]);
  delete from public.group_members where group_id = p_group_id and user_id = p_user;
end;
$$;

revoke execute on function public.leave_group_as(uuid, uuid, uuid)
  from public, anon, authenticated;

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
  end if;
  perform public.leave_group_as(p_group_id, v_me, v_successor);
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_group record;
  v_successor uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  -- 1. Salir de mis grupos avisando a los demás. Si soy el líder, el grupo pasa al miembro
  --    activo más antiguo; si no queda nadie, se borra.
  for v_group in
    select m.group_id as id, (g.owner_id = v_user_id) as leader
      from public.group_members m
      join public.groups g on g.id = m.group_id
     where m.user_id = v_user_id and m.status = 'active'
  loop
    v_successor := null;
    if v_group.leader then
      select m.user_id into v_successor
        from public.group_members m
       where m.group_id = v_group.id and m.status = 'active' and m.user_id <> v_user_id
       order by m.joined_at nulls last, m.user_id
       limit 1;
      if v_successor is null then
        delete from public.groups where id = v_group.id;
        continue;
      end if;
    end if;
    perform public.leave_group_as(v_group.id, v_user_id, v_successor);
  end loop;

  -- 2. Mis contadores compartidos pasan al líder de su grupo (por si quedaba alguno).
  update public.counters c
     set owner_id = g.owner_id
    from public.groups g
   where c.group_id = g.id
     and c.owner_id = v_user_id
     and g.owner_id <> v_user_id;

  -- 3. Borrar la cuenta (el resto cae en cascada).
  delete from auth.users where id = v_user_id;
end;
$$;

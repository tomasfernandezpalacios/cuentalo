-- Administración de grupos (petición del usuario). Sigue habiendo UN administrador por grupo
-- (groups.owner_id y group_members.role = 'owner'), pero ahora puede cambiar:
--
-- * transfer_group_admin: el administrador designa a otro miembro activo; él pasa a miembro.
-- * resign_group_admin: el administrador deja de serlo y se elige a otro miembro activo al azar.
-- * leave_group: cualquiera sale del grupo; si es el administrador, antes se elige a otro al
--   azar. El último miembro no puede salir: tiene que eliminar el grupo.
--
-- El nuevo administrador recibe un aviso. Al salir, sus contadores del grupo pasan al nuevo
-- administrador (lo hace el trigger on_group_member_left, que ya existía).

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'friend_accepted', 'request_approved', 'request_rejected', 'counter_deleted', 'group_deleted',
  'group_admin'
));

-- Cambia el administrador de un grupo (sin comprobar permisos: lo hacen quienes la llaman).
create function public.set_group_admin(p_group_id uuid, p_new_admin uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old uuid;
  v_name text;
begin
  select owner_id, name into v_old, v_name from public.groups where id = p_group_id for update;
  update public.groups set owner_id = p_new_admin where id = p_group_id;
  update public.group_members set role = 'member'
   where group_id = p_group_id and user_id = v_old;
  update public.group_members set role = 'owner'
   where group_id = p_group_id and user_id = p_new_admin;
  perform public.notify(p_new_admin, 'group_admin', null, v_name);
end;
$$;

revoke execute on function public.set_group_admin(uuid, uuid) from public, anon, authenticated;

-- Otro miembro activo al azar (null si no queda nadie más).
create function public.random_group_member(p_group_id uuid, p_except uuid)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  select m.user_id from public.group_members m
   where m.group_id = p_group_id and m.status = 'active' and m.user_id <> p_except
   order by random()
   limit 1;
$$;

revoke execute on function public.random_group_member(uuid, uuid) from public, anon, authenticated;

create function public.transfer_group_admin(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Solo el administrador puede designar a otro.';
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

create function public.resign_group_admin(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_successor uuid;
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'No eres el administrador de este grupo.';
  end if;
  v_successor := public.random_group_member(p_group_id, (select auth.uid()));
  if v_successor is null then
    raise exception 'Eres el único miembro del grupo: no hay nadie a quien pasarle la administración.';
  end if;
  perform public.set_group_admin(p_group_id, v_successor);
  return v_successor;
end;
$$;

create function public.leave_group(p_group_id uuid)
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

revoke execute on function public.transfer_group_admin(uuid, uuid) from public, anon;
revoke execute on function public.resign_group_admin(uuid) from public, anon;
revoke execute on function public.leave_group(uuid) from public, anon;
grant execute on function public.transfer_group_admin(uuid, uuid) to authenticated;
grant execute on function public.resign_group_admin(uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;

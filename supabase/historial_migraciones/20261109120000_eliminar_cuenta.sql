-- Fase 5: eliminar la propia cuenta (obligatorio para publicar en App Store).
--
-- Borra el usuario de auth.users y, en cascada, su perfil, sus contadores privados, sus
-- registros, sus amistades y sus membresías. Antes, para no estropear los grupos de los demás:
-- * Los grupos que administro pasan al miembro activo más antiguo; si no queda nadie, se borran.
-- * Mis contadores compartidos pasan al owner de su grupo, así los registros de los demás
--   miembros no se pierden.
-- La app nunca usa la service_role key: lo hace esta función SECURITY DEFINER, que solo puede
-- borrar al usuario que la llama.

create function public.delete_my_account()
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

  -- 1. Traspasar los grupos que administro.
  for v_group in select g.id from public.groups g where g.owner_id = v_user_id loop
    select m.user_id into v_successor
      from public.group_members m
     where m.group_id = v_group.id and m.status = 'active' and m.user_id <> v_user_id
     order by m.joined_at nulls last, m.user_id
     limit 1;

    if v_successor is null then
      delete from public.groups where id = v_group.id;
    else
      update public.groups set owner_id = v_successor where id = v_group.id;
      update public.group_members set role = 'owner'
       where group_id = v_group.id and user_id = v_successor;
    end if;
  end loop;

  -- 2. Mis contadores compartidos pasan al owner de su grupo.
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

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

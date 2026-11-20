-- Versión personal de un contador de grupo y aviso al editarlo (petición del usuario,
-- 2026-11-19).
--  * Cualquier miembro puede ponerle a un contador de grupo SU nombre, imagen (emoticono o foto) y
--    unidad: solo los ve él, fuera del grupo (dentro del grupo se ve como lo dejó el
--    administrador). Se guardan en counter_aliases, que gana unit y photo_path.
--  * Las fotos personales van al bucket counter-photos en 'personal/<user_id>/…': solo las ve y
--    toca su dueño (las políticas de antes no las cubren: group_id_from_path da null).
--  * Si el administrador lo cambia para todos, los demás miembros activos reciben un aviso
--    'counter_edited' (uno por ráfaga de cambios, p. ej. nombre y foto a la vez).
--  * Al sacarlo del grupo, cada uno conserva su versión: el contador privado nuevo nace con su
--    nombre, emoticono y unidad, y su foto personal sigue como alias de ese contador.

alter table public.counter_aliases
  add column unit text,
  add column photo_path text;
alter table public.counter_aliases add constraint counter_aliases_unit_check
  check (unit is null or (char_length(btrim(unit)) between 1 and 30));

-- Fotos personales ---------------------------------------------------------------------------

create policy "counter-photos: cada uno ve sus fotos personales"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'counter-photos'
    and (storage.foldername(name))[1] = 'personal'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "counter-photos: cada uno sube sus fotos personales"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'counter-photos'
    and (storage.foldername(name))[1] = 'personal'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "counter-photos: cada uno cambia sus fotos personales"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'counter-photos'
    and (storage.foldername(name))[1] = 'personal'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "counter-photos: cada uno borra sus fotos personales"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'counter-photos'
    and (storage.foldername(name))[1] = 'personal'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- Aviso al editar para todos -------------------------------------------------------------------

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind = any (array[
  'friend_accepted', 'friend_you_accepted', 'request_approved', 'request_rejected',
  'counter_deleted', 'group_deleted', 'group_admin', 'member_left', 'new_leader',
  'you_are_leader', 'kicked', 'group_activity', 'user_blocked', 'counter_edited'
]::text[]));

create or replace function public.notify_counter_edited()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_name text;
  v_group_name text;
begin
  if new.group_id is null or v_actor is null then
    return new;
  end if;
  if new.name is not distinct from old.name
     and new.unit is not distinct from old.unit
     and new.emoji is not distinct from old.emoji
     and new.photo_path is not distinct from old.photo_path then
    return new;
  end if;
  select p.display_name into v_actor_name from public.profiles p where p.id = v_actor;
  select g.name into v_group_name from public.groups g where g.id = new.group_id;

  -- Varios cambios seguidos (nombre y foto se guardan por separado): un solo aviso, al día.
  update public.notifications n
     set counter_name = new.name, created_at = now()
   where n.kind = 'counter_edited'
     and n.counter_id = new.id
     and n.actor_id = v_actor
     and n.read_at is null
     and n.created_at > now() - interval '2 minutes';

  insert into public.notifications (user_id, kind, actor_id, actor_name, counter_id,
                                    counter_name, group_name)
  select m.user_id, 'counter_edited', v_actor, v_actor_name, new.id, new.name, v_group_name
    from public.group_members m
   where m.group_id = new.group_id
     and m.status = 'active'
     and m.user_id <> v_actor
     and not exists (
       select 1 from public.notifications n
        where n.user_id = m.user_id
          and n.kind = 'counter_edited'
          and n.counter_id = new.id
          and n.actor_id = v_actor
          and n.read_at is null
          and n.created_at > now() - interval '2 minutes'
     );
  return new;
end;
$$;
revoke all on function public.notify_counter_edited() from public, anon, authenticated;

create trigger on_counter_edited
  after update of name, unit, emoji, photo_path on public.counters
  for each row execute function public.notify_counter_edited();

-- Al sacarlo del grupo, cada uno conserva su versión --------------------------------------------

create or replace function public.dissolve_group_counter(p_counter_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counter public.counters;
  v_group_name text;
  v_user uuid;
  v_link uuid;
  v_new uuid;
  v_alias public.counter_aliases;
begin
  select * into v_counter from public.counters where id = p_counter_id;
  if v_counter.id is null then
    return;
  end if;
  select g.name into v_group_name from public.groups g where g.id = v_counter.group_id;

  for v_user in
    select e.user_id from public.entries e where e.counter_id = p_counter_id
    union
    select l.user_id from public.counter_links l where l.counter_id = p_counter_id
  loop
    select l.link_id into v_link
      from public.counter_links l where l.user_id = v_user and l.counter_id = p_counter_id;
    v_alias := null;
    select * into v_alias
      from public.counter_aliases a where a.user_id = v_user and a.counter_id = p_counter_id;

    -- El contador con el que lo tenía fusionado (si sigue existiendo otro en el enlace).
    select l.counter_id into v_new
      from public.counter_links l
     where l.user_id = v_user and l.link_id = v_link and l.counter_id <> p_counter_id
     order by l.is_primary desc, l.counter_id
     limit 1;

    if v_new is not null then
      -- Sus registros pasan a ese contador como solo personales; las copias para este grupo
      -- sobran (ya hay una copia del mismo registro allí).
      update public.entries
         set counter_id = v_new, personal_only = true, group_only = false
       where counter_id = p_counter_id and user_id = v_user and not group_only;
      delete from public.entries where counter_id = p_counter_id and user_id = v_user;
      delete from public.counter_links where user_id = v_user and counter_id = p_counter_id;
      update public.counter_links set is_primary = (counter_id = v_new)
       where user_id = v_user and link_id = v_link;
      if (select count(*) from public.counter_links where user_id = v_user and link_id = v_link) < 2 then
        delete from public.counter_links where user_id = v_user and link_id = v_link;
      end if;
      if v_alias.counter_id is not null then
        insert into public.counter_aliases (counter_id, user_id, name, emoji, unit, photo_path)
        values (v_new, v_user, v_alias.name, v_alias.emoji, v_alias.unit, v_alias.photo_path)
        on conflict do nothing;
      end if;
    else
      -- Contador privado nuevo con su versión personal (o la del grupo) y todos sus registros.
      insert into public.counters (owner_id, name, unit, emoji)
      values (
        v_user,
        coalesce(v_alias.name, v_counter.name),
        coalesce(v_alias.unit, v_counter.unit),
        case when v_alias.photo_path is not null or v_alias.emoji is not null
             then v_alias.emoji else v_counter.emoji end
      )
      returning id into v_new;
      -- Su foto personal sigue siendo suya (alias del contador nuevo).
      if v_alias.photo_path is not null then
        insert into public.counter_aliases (counter_id, user_id, photo_path)
        values (v_new, v_user, v_alias.photo_path)
        on conflict do nothing;
      end if;
      update public.entries
         set counter_id = v_new, personal_only = false, group_only = false
       where counter_id = p_counter_id and user_id = v_user;
      delete from public.counter_links where user_id = v_user and counter_id = p_counter_id;
      insert into public.folder_counters (folder_id, counter_id)
      select fc.folder_id, v_new
        from public.folder_counters fc
        join public.folders f on f.id = fc.folder_id
       where fc.counter_id = p_counter_id and f.owner_id = v_user
      on conflict do nothing;
      -- Y si veía su racha, la sigue viendo.
      insert into public.shown_counter_streaks (user_id, counter_id)
      select v_user, v_new
       where exists (
         select 1 from public.shown_counter_streaks s
          where s.user_id = v_user and s.counter_id = p_counter_id
       )
      on conflict do nothing;
    end if;

    perform public.notify(v_user, p_kind, coalesce(v_alias.name, v_counter.name), v_group_name);
    v_new := null;
    v_link := null;
  end loop;

  delete from public.counters where id = p_counter_id;
end;
$$;

-- Mis alias traen también la unidad y la foto personales.
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
      select json_agg(json_build_object(
        'counter_id', a.counter_id, 'name', a.name, 'emoji', a.emoji,
        'unit', a.unit, 'photo_path', a.photo_path
      ))
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

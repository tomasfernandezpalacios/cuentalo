-- Administrador de los contadores de grupo, borrar sin perder datos, solicitudes en contadores
-- comunes, avisos (buzón) y contadores ocultos. Peticiones del usuario.
--
-- * El administrador de un contador de grupo es quien lo creó (owner_id). Solo él lo edita y lo
--   borra. Si sale del grupo, sus contadores pasan al owner del grupo.
-- * Borrar un contador de grupo (o el grupo entero) solo lo quita del grupo: cada miembro
--   conserva sus registros, en el contador con el que lo tuviera fusionado o en uno privado nuevo
--   con el mismo nombre. A cada uno le llega un aviso.
-- * En un contador común solo el administrador suma o resta. Los demás le envían solicitudes,
--   que él acepta (se suma sola) o rechaza.
-- * Avisos: tabla notifications, que solo lee su destinatario.
-- * Ocultos: cada usuario puede ocultar contadores de su lista (hidden_counters).

-- ---------------------------------------------------------------------------
-- Administrador
-- ---------------------------------------------------------------------------

-- ¿Soy el administrador de este contador de grupo? (Lo creé y sigo en el grupo.)
create function public.is_counter_admin(p_counter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.counters c
     where c.id = p_counter_id
       and c.group_id is not null
       and c.owner_id = (select auth.uid())
       and public.is_group_member(c.group_id)
  );
$$;

drop policy "counters: editan el dueño o el owner del grupo" on public.counters;
create policy "counters: edita el dueño o el administrador"
  on public.counters for update
  to authenticated
  using (
    (group_id is null and owner_id = (select auth.uid()))
    or (group_id is not null and public.is_counter_admin(id))
  );

-- En un común solo registra el administrador (el resto envía solicitudes).
create or replace function public.can_log_common(p_counter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.counters c
     where c.id = p_counter_id and c.is_common and public.is_counter_admin(c.id)
  );
$$;

create or replace function public.set_counter_participants(p_counter_id uuid, p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  select c.group_id into v_group_id
    from public.counters c
   where c.id = p_counter_id and c.is_common;
  if v_group_id is null then
    raise exception 'not_common_counter';
  end if;
  if not public.is_counter_admin(p_counter_id) then
    raise exception 'not_counter_manager';
  end if;
  if coalesce(array_length(p_user_ids, 1), 0) = 0 then
    raise exception 'no_participants';
  end if;

  delete from public.counter_participants where counter_id = p_counter_id;
  insert into public.counter_participants (counter_id, user_id)
  select p_counter_id, m.user_id
    from public.group_members m
   where m.group_id = v_group_id
     and m.status = 'active'
     and m.user_id = any (p_user_ids);
end;
$$;

-- Si alguien sale del grupo (o lo expulsan), sus contadores del grupo pasan al owner del grupo.
create function public.transfer_counters_on_leave()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.counters c
     set owner_id = g.owner_id
    from public.groups g
   where c.group_id = old.group_id
     and g.id = old.group_id
     and c.owner_id = old.user_id
     and g.owner_id <> old.user_id;
  return old;
end;
$$;

create trigger on_group_member_left
  after delete on public.group_members
  for each row execute function public.transfer_counters_on_leave();

-- ---------------------------------------------------------------------------
-- Avisos
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'friend_accepted', 'request_approved', 'request_rejected', 'counter_deleted', 'group_deleted'
  )),
  actor_id uuid references public.profiles (id) on delete set null,
  -- Se guardan los nombres porque el contador o el grupo pueden haber desaparecido.
  counter_name text,
  group_name text,
  amount numeric,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications: cada uno las suyas"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "notifications: cada uno marca las suyas como leídas"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create function public.notify(
  p_user_id uuid,
  p_kind text,
  p_counter_name text default null,
  p_group_name text default null,
  p_amount numeric default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, actor_id, counter_name, group_name, amount)
  select p_user_id, p_kind, (select auth.uid()), p_counter_name, p_group_name, p_amount
   where p_user_id is distinct from (select auth.uid());
$$;

-- Al aceptar una solicitud de amistad, se avisa a quien la envió. (Un rechazo no se avisa.)
create function public.notify_friend_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    perform public.notify(new.requester_id, 'friend_accepted');
  end if;
  return new;
end;
$$;

create trigger on_friendship_accepted
  after update on public.friendships
  for each row execute function public.notify_friend_accepted();

-- ---------------------------------------------------------------------------
-- Solicitudes en contadores comunes
-- ---------------------------------------------------------------------------

create table public.counter_requests (
  id uuid primary key default gen_random_uuid(),
  counter_id uuid not null references public.counters (id) on delete cascade,
  requester_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  amount numeric not null check (amount <> 0 and abs(amount) < 1000000000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index counter_requests_counter_idx on public.counter_requests (counter_id, status);

alter table public.counter_requests enable row level security;

create policy "counter_requests: las ven quien pide y el administrador"
  on public.counter_requests for select
  to authenticated
  using (requester_id = (select auth.uid()) or public.is_counter_admin(counter_id));

create policy "counter_requests: los miembros piden en comunes ajenos"
  on public.counter_requests for insert
  to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.counters c
       where c.id = counter_id
         and c.is_common
         and public.is_group_member(c.group_id)
         and not public.is_counter_admin(c.id)
    )
  );

revoke all on public.counter_requests from anon, authenticated;
grant select, insert on public.counter_requests to authenticated;

-- El administrador acepta (se aplica a todos los participantes) o rechaza.
create function public.decide_counter_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.counter_requests;
  v_counter public.counters;
begin
  select * into v_request from public.counter_requests where id = p_request_id for update;
  if v_request.id is null or v_request.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;
  if not public.is_counter_admin(v_request.counter_id) then
    raise exception 'not_counter_manager';
  end if;
  select * into v_counter from public.counters where id = v_request.counter_id;

  if p_approve then
    if v_request.amount > 0 then
      perform public.add_to_common_counter(v_request.counter_id, v_request.amount);
    else
      perform public.remove_one_from_common_counter(v_request.counter_id);
    end if;
  end if;

  update public.counter_requests
     set status = case when p_approve then 'approved' else 'rejected' end, decided_at = now()
   where id = p_request_id;

  perform public.notify(
    v_request.requester_id,
    case when p_approve then 'request_approved' else 'request_rejected' end,
    v_counter.name,
    (select g.name from public.groups g where g.id = v_counter.group_id),
    v_request.amount
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Borrar un contador solo para el grupo
-- ---------------------------------------------------------------------------

-- Saca del grupo un contador sin que nadie pierda sus registros, y lo borra.
create function public.dissolve_group_counter(p_counter_id uuid, p_kind text)
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
        insert into public.counter_aliases (counter_id, user_id, name, emoji)
        values (v_new, v_user, v_alias.name, v_alias.emoji)
        on conflict do nothing;
      end if;
    else
      -- Contador privado nuevo con el mismo nombre (o su alias) y todos sus registros.
      insert into public.counters (owner_id, name, unit, emoji)
      values (
        v_user,
        coalesce(v_alias.name, v_counter.name),
        v_counter.unit,
        coalesce(v_alias.emoji, v_counter.emoji)
      )
      returning id into v_new;
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
    end if;

    perform public.notify(v_user, p_kind, v_counter.name, v_group_name);
    v_new := null;
    v_link := null;
  end loop;

  delete from public.counters where id = p_counter_id;
end;
$$;

-- Solo el administrador borra un contador de grupo.
create function public.delete_group_counter(p_counter_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_counter_admin(p_counter_id) then
    raise exception 'not_counter_manager';
  end if;
  perform public.dissolve_group_counter(p_counter_id, 'counter_deleted');
end;
$$;

-- Al borrar un grupo, sus contadores salen del grupo igual: nadie pierde sus registros.
create function public.dissolve_group_counters_on_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counter uuid;
begin
  for v_counter in select c.id from public.counters c where c.group_id = old.id loop
    perform public.dissolve_group_counter(v_counter, 'group_deleted');
  end loop;
  return old;
end;
$$;

create trigger on_group_deleted
  before delete on public.groups
  for each row execute function public.dissolve_group_counters_on_delete();

-- ---------------------------------------------------------------------------
-- Ocultos
-- ---------------------------------------------------------------------------

create table public.hidden_counters (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  counter_id uuid not null references public.counters (id) on delete cascade,
  primary key (user_id, counter_id)
);

alter table public.hidden_counters enable row level security;

create policy "hidden_counters: cada uno los suyos"
  on public.hidden_counters for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.hidden_counters from anon, authenticated;
grant select, insert, delete on public.hidden_counters to authenticated;

-- ---------------------------------------------------------------------------
-- Permisos de las funciones
-- ---------------------------------------------------------------------------

revoke execute on function
  public.is_counter_admin(uuid),
  public.notify(uuid, text, text, text, numeric),
  public.decide_counter_request(uuid, boolean),
  public.dissolve_group_counter(uuid, text),
  public.delete_group_counter(uuid)
from public, anon;
-- notify y dissolve solo los usan otras funciones, no la app.
revoke execute on function
  public.notify(uuid, text, text, text, numeric),
  public.dissolve_group_counter(uuid, text)
from authenticated;
grant execute on function
  public.is_counter_admin(uuid),
  public.decide_counter_request(uuid, boolean),
  public.delete_group_counter(uuid)
to authenticated;

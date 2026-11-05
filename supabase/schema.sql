-- Esquema completo de Cuéntalo (Supabase / Postgres 17).
--
-- Es el estado final de todas las migraciones (de 20261103 a 20261207) en un solo archivo y
-- ordenado: sirve para crear la base de datos desde cero (p. ej. un proyecto nuevo en la
-- Fase 6). Se generó a partir de la base de datos real y se comprobó que cada función coincide
-- con la que hay en producción. La base de datos actual YA tiene todo esto: no hay que
-- ejecutarlo sobre ella.
--
-- Cambios nuevos: una migración nueva en supabase/migrations/ (y, si cambia el esquema, se
-- actualiza también este archivo). Las migraciones antiguas están en
-- supabase/historial_migraciones/ como referencia.
--
-- Orden: funciones · tablas · restricciones · índices · RLS · vistas · políticas · triggers ·
-- permisos · Storage. Las funciones van primero porque las usan los valores por defecto, las
-- vistas y las políticas; con check_function_bodies = off no se validan sus cuerpos hasta
-- usarlas (las tablas aún no existen).

set check_function_bodies = off;

-- Supabase ya trae pgcrypto en el esquema extensions (lo usa generate_invite_code).
create extension if not exists pgcrypto with schema extensions;


-- ===========================================================================
-- 1. Funciones
-- ===========================================================================


-- +N para todos los participantes que siguen en el grupo. Devuelve a cuántos se ha sumado.
create or replace function public.add_to_common_counter(
  p_counter_id uuid,
  p_amount numeric,
  p_logged_at timestamptz default now(),
  p_note text default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if not public.can_log_common(p_counter_id) then
    raise exception 'cannot_log_common';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  insert into public.entries (counter_id, user_id, amount, logged_at, note)
  select p_counter_id, p.user_id, p_amount, coalesce(p_logged_at, now()), p_note
    from public.counter_participants p
    join public.counters c on c.id = p.counter_id
    join public.group_members m
      on m.group_id = c.group_id and m.user_id = p.user_id and m.status = 'active'
   where p.counter_id = p_counter_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.are_friends(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(p_user_a, p_user_b)
      and greatest(f.requester_id, f.addressee_id) = greatest(p_user_a, p_user_b)
  );
$$;

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

-- En un contador común se registra con add_to_common_counter; la vía normal (insertar una fila
-- propia) queda para los miembros, igual que en un compartido.
create or replace function public.can_log_to_counter(p_counter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.counters c
    where c.id = p_counter_id
      and (
        (c.group_id is null and c.owner_id = (select auth.uid()))
        or (c.group_id is not null and not c.is_common and public.is_group_member(c.group_id))
        or (c.is_common and public.can_log_common(c.id))
      )
  );
$$;

-- ¿Puedo ver este registro ajeno? Solo si el contador es de un grupo donde ambos somos
-- miembros activos.
create or replace function public.can_view_group_entry(p_counter_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.counters c
    join public.group_members m
      on m.group_id = c.group_id and m.user_id = p_user_id and m.status = 'active'
    where c.id = p_counter_id
      and c.group_id is not null
      and public.is_group_member(c.group_id)
  );
$$;

-- El administrador acepta (se aplica a todos los participantes) o rechaza.
create or replace function public.decide_counter_request(p_request_id uuid, p_approve boolean)
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

-- Solo el administrador borra un contador de grupo.
create or replace function public.delete_group_counter(p_counter_id uuid)
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

-- Saca del grupo un contador sin que nadie pierda sus registros, y lo borra.
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

-- Al borrar un grupo, sus contadores salen del grupo igual: nadie pierde sus registros.
create or replace function public.dissolve_group_counters_on_delete()
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

-- 8 caracteres de un alfabeto sin los que se confunden (0/O, 1/I/L): 31^8 ≈ 850 000 millones
-- de combinaciones, imposible de adivinar a ciegas. Usa bytes aleatorios criptográficos.
-- SECURITY DEFINER porque se usa como valor por defecto al crear un grupo (lo ejecuta el
-- usuario) y necesita la extensión pgcrypto del esquema extensions.
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_code text := '';
begin
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- Rachas de amigos: «hoy» es el de quien mira.
create or replace function public.get_friends_streaks()
returns table (
  user_id uuid,
  username text,
  display_name text,
  current_streak int,
  best_streak int,
  active_today boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as id
  ),
  people as (
    select id from me where id is not null
    union
    select case when f.requester_id = me.id then f.addressee_id else f.requester_id end
      from public.friendships f, me
     where f.status = 'accepted' and me.id in (f.requester_id, f.addressee_id)
       -- Quien oculta su racha no sale en la de sus amigos (pero sí se ve a sí mismo).
       and not (
         select pr.hide_streak from public.profiles pr
          where pr.id = case when f.requester_id = me.id then f.addressee_id else f.requester_id end
       )
  ),
  islands as (
    select a.user_id, a.day,
           a.day - (row_number() over (partition by a.user_id order by a.day))::int as grp
      from public.user_activity_days a
     where a.user_id in (select id from people)
  ),
  runs as (
    select i.user_id, max(i.day) as end_day, count(*)::int as len
      from islands i
     group by i.user_id, i.grp
  ),
  today as (
    select (now() at time zone public.my_time_zone())::date as d
  )
  select
    p.id,
    pr.username,
    pr.display_name,
    coalesce((
      select r.len from runs r, today
       where r.user_id = p.id and r.end_day >= today.d - 1
       order by r.end_day desc
       limit 1
    ), 0) as current_streak,
    coalesce((select max(r.len) from runs r where r.user_id = p.id), 0) as best_streak,
    exists (
      select 1 from public.user_activity_days a, today
       where a.user_id = p.id and a.day = today.d
    ) as active_today
  from people p
  join public.profiles pr on pr.id = p.id;
$$;

-- Gráfica del grupo.
create or replace function public.get_group_counter_daily(p_counter_id uuid)
returns table (user_id uuid, day date, total numeric)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  select c.group_id into v_group_id from public.counters c where c.id = p_counter_id;
  if v_group_id is null or not public.is_group_member(v_group_id) then
    raise exception 'not_shared_counter';
  end if;

  return query
  select e.user_id,
         (e.logged_at at time zone public.my_time_zone())::date,
         sum(e.amount)
    from public.entries e
    join public.group_members m
      on m.group_id = v_group_id and m.user_id = e.user_id and m.status = 'active'
   where e.counter_id = p_counter_id and not e.personal_only
   group by e.user_id, (e.logged_at at time zone public.my_time_zone())::date
   order by 2;
end;
$$;

-- El código de unión del grupo deja de ser solo del líder: cualquier miembro activo lo ve, lo
-- comparte y puede generar uno nuevo (petición del usuario). Invitados y gente de fuera, no.
-- La columna groups.invite_code sigue sin poder leerse directamente.
create or replace function public.get_group_invite_code(p_group_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'not_group_member';
  end if;
  select g.invite_code into v_code from public.groups g where g.id = p_group_id;
  return v_code;
end;
$$;

-- Clasificación por periodo: la semana/mes/año naturales de quien mira.
create or replace function public.get_leaderboard(counter_id uuid, period text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  total numeric,
  entry_count int,
  "position" int
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_start timestamp;
begin
  if period not in ('week', 'month', 'year', 'all') then
    raise exception 'invalid_period';
  end if;

  select c.group_id into v_group_id from public.counters c where c.id = get_leaderboard.counter_id;
  if v_group_id is null or not public.is_group_member(v_group_id) then
    raise exception 'not_shared_counter';
  end if;

  if period <> 'all' then
    v_start := date_trunc(period, now() at time zone public.my_time_zone());
  end if;

  return query
  select
    m.user_id,
    p.username,
    p.display_name,
    coalesce(sum(e.amount), 0) as total,
    (count(e.id) filter (where e.amount > 0))::int as entry_count,
    (rank() over (order by coalesce(sum(e.amount), 0) desc))::int as "position"
  from public.group_members m
  join public.profiles p on p.id = m.user_id
  left join public.entries e
    on e.counter_id = get_leaderboard.counter_id
   and e.user_id = m.user_id
   and not e.personal_only
   and (v_start is null or (e.logged_at at time zone public.my_time_zone()) >= v_start)
  where m.group_id = v_group_id and m.status = 'active'
  group by m.user_id, p.username, p.display_name
  order by 6, 3;
end;
$$;

-- SECURITY INVOKER: cada tabla se lee con su RLS como hasta ahora; solo cambia que va todo junto
-- y que la lista de contadores se filtra primero por los que veo (con índices).
create or replace function public.get_my_home()
returns json
language sql
stable
security invoker
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
    ), '[]'::json)
  );
$$;

-- Rachas de un contador de grupo.
create or replace function public.get_streak_leaderboard(p_counter_id uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  total numeric,
  best numeric,
  "position" int
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  select c.group_id into v_group_id from public.counters c where c.id = p_counter_id;
  if v_group_id is null or not public.is_group_member(v_group_id) then
    raise exception 'not_shared_counter';
  end if;

  return query
  with days as (
    select e.user_id,
           (e.logged_at at time zone public.my_time_zone())::date as day,
           sum(e.amount) as amount
      from public.entries e
     where e.counter_id = p_counter_id and not e.personal_only
     group by e.user_id, (e.logged_at at time zone public.my_time_zone())::date
  ),
  islands as (
    select d.user_id, d.day,
           d.day - (row_number() over (partition by d.user_id order by d.day))::int as grp
      from days d
     where d.amount >= 1
  ),
  runs as (
    select i.user_id, max(i.day) as end_day, count(*)::int as days
      from islands i
     group by i.user_id, i.grp
  ),
  today as (
    select (now() at time zone public.my_time_zone())::date as d
  ),
  per_user as (
    select r.user_id,
           coalesce(max(r.days) filter (where r.end_day >= t.d - 1), 0) as current_days,
           max(r.days) as best_days
      from runs r cross join today t
     group by r.user_id
  )
  select
    m.user_id,
    p.username,
    p.display_name,
    coalesce(u.current_days, 0)::numeric,
    coalesce(u.best_days, 0)::numeric,
    (rank() over (order by coalesce(u.current_days, 0) desc))::int
  from public.group_members m
  join public.profiles p on p.id = m.user_id
  left join per_user u on u.user_id = m.user_id
  where m.group_id = v_group_id and m.status = 'active'
  order by 6, 3;
end;
$$;

-- Perfil de otra persona: los contadores en común (de grupos de los dos) y, si somos
-- amigos, sus individuales que no son privados y los de sus grupos (solo totales).
create or replace function public.get_user_counters(p_user_id uuid)
returns table (
  counter_id uuid,
  name text,
  emoji text,
  unit text,
  group_name text,
  kind text,
  their_total numeric,
  my_total numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as id
  ),
  friends as (
    select exists (
      select 1 from public.friendships f, me
       where f.status = 'accepted'
         and least(f.requester_id, f.addressee_id) = least(me.id, p_user_id)
         and greatest(f.requester_id, f.addressee_id) = greatest(me.id, p_user_id)
    ) as yes
  ),
  their_groups as (
    select m.group_id from public.group_members m
     where m.user_id = p_user_id and m.status = 'active'
  ),
  my_groups as (
    select m.group_id from public.group_members m, me
     where m.user_id = me.id and m.status = 'active'
  ),
  visible as (
    -- En común: contadores de grupos de los dos.
    select c.*, 'common'::text as kind
      from public.counters c
     where c.group_id in (select group_id from their_groups)
       and c.group_id in (select group_id from my_groups)
    union all
    -- Para amigos: sus individuales no ocultos y los de sus grupos en los que no estoy.
    select c.*, 'public'::text
      from public.counters c, friends
     where friends.yes
       and (
         (c.group_id is null and c.owner_id = p_user_id and not c.hidden_from_friends)
         or (c.group_id in (select group_id from their_groups)
             and c.group_id not in (select group_id from my_groups))
       )
  )
  select
    v.id,
    v.name,
    v.emoji,
    v.unit,
    g.name,
    v.kind,
    -- Si oculta sus números a sus amigos, en sus contadores (no en los en común) va null.
    case when v.kind = 'public'
              and (select pr.hide_counter_totals from public.profiles pr where pr.id = p_user_id)
         then null
         else coalesce((
           select sum(e.amount) from public.entries e
            where e.counter_id = v.id and e.user_id = p_user_id
              and case when v.group_id is null then not e.group_only else not e.personal_only end
         ), 0)
    end,
    case when v.kind = 'common' then coalesce((
      select sum(e.amount) from public.entries e, me
       where e.counter_id = v.id and e.user_id = me.id and not e.personal_only
    ), 0) end
  from visible v
  left join public.groups g on g.id = v.group_id
  where p_user_id <> (select id from me)
  order by v.kind, v.name;
$$;

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

-- Id del grupo a partir de la ruta '<group_id>/...'; null si la ruta no tiene esa forma (así
-- las políticas nunca fallan al convertir a uuid).
create or replace function public.group_id_from_path(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

-- Al crear un grupo, su creador entra como owner activo.
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id, role, status, joined_at)
  values (new.id, new.owner_id, 'owner', 'active', now());
  return new;
end;
$$;

-- Crea el perfil a partir de los metadatos enviados en signUp({ options: { data } }).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      new.raw_user_meta_data ->> 'username'
    )
  );
  return new;
end;
$$;

-- ¿Tengo registros en este contador? (para seguir viéndolo tras salir de un grupo)
create or replace function public.has_entries_in_counter(p_counter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entries e
    where e.counter_id = p_counter_id and e.user_id = (select auth.uid())
  );
$$;

-- ¿Soy el administrador de este contador de grupo? (Lo creé y sigo en el grupo.)
create or replace function public.is_counter_admin(p_counter_id uuid)
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

-- Soy miembro activo del grupo.
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;

create or replace function public.is_group_owner(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.groups g
    where g.id = p_group_id and g.owner_id = (select auth.uid())
  );
$$;

-- Estoy en el grupo, como miembro activo o con una invitación pendiente.
create or replace function public.is_group_participant(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = (select auth.uid())
  );
$$;

-- Permite comprobar en el formulario de registro (aún sin sesión) si un username está libre.
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where username = lower(p_username)
  );
$$;

-- Unirse con el código. Es una vía distinta a la invitación del owner: quien tiene el código
-- puede entrar aunque no sea amigo del owner (el owner decide con quién lo comparte).
create or replace function public.join_group_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select g.id into v_group_id
    from public.groups g
   where g.invite_code = public.normalize_invite_code(p_code);
  if v_group_id is null then
    raise exception 'invalid_invite_code';
  end if;

  insert into public.group_members (group_id, user_id, role, status, joined_at)
  values (v_group_id, v_user_id, 'member', 'active', now())
  on conflict (group_id, user_id) do update
    set status = 'active',
        joined_at = coalesce(public.group_members.joined_at, now());
  return v_group_id;
end;
$$;

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

-- Quien sale (p_user) deja el grupo: si era el líder, pasa a p_successor con sus avisos; luego
-- se avisa a los demás de que ha salido y se borra su fila. Sin comprobar permisos: lo hacen
-- leave_group y delete_my_account.
create or replace function public.leave_group_as(p_group_id uuid, p_user uuid, p_successor uuid)
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

-- +N en un contador (no común) y en todos los enlazados con él. Devuelve cuántas copias.
create or replace function public.log_to_counter(
  p_counter_id uuid,
  p_amount numeric,
  p_logged_at timestamptz default now(),
  p_note text default null
)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_first boolean := true;
  v_count int := 0;
  r record;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  for r in select * from public.my_linked_counters(p_counter_id) loop
    -- Se salta los contadores donde ya no puedo registrar (p. ej. si salí de ese grupo).
    continue when not public.can_log_to_counter(r.counter_id);
    insert into public.entries (counter_id, amount, logged_at, note, group_only, batch_id)
    values (r.counter_id, p_amount, coalesce(p_logged_at, now()), p_note, not v_first, v_batch);
    v_first := false;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'cannot_log';
  end if;
  return v_count;
end;
$$;

-- Fusionar (ahora admite varios contadores de grupo)
create or replace function public.merge_counters(p_counter_ids uuid[], p_name text, p_emoji text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_ids uuid[];
  v_group_ids uuid[];
  v_private_ids uuid[];
  v_target uuid;
  v_link uuid := gen_random_uuid();
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_emoji text := nullif(btrim(coalesce(p_emoji, '')), '');
begin
  -- Si alguno ya estaba enlazado, entra todo su enlace.
  v_ids := array(
    select distinct x from (
      select unnest(p_counter_ids) as x
      union
      select l.counter_id from public.counter_links l
       where l.user_id = v_user_id
         and l.link_id in (
           select l2.link_id from public.counter_links l2
            where l2.user_id = v_user_id and l2.counter_id = any (p_counter_ids)
         )
    ) s
  );

  if coalesce(array_length(v_ids, 1), 0) < 2 then
    raise exception 'merge_needs_two';
  end if;

  -- Todos visibles y ninguno común.
  if (select count(*) from public.counters c where c.id = any (v_ids) and not c.is_common)
     <> array_length(v_ids, 1) then
    raise exception 'merge_invalid_counters';
  end if;

  -- Los individuales tienen que ser míos; en los de grupo tengo que poder registrar.
  if exists (
    select 1 from public.counters c
     where c.id = any (v_ids)
       and (
         (c.group_id is null and c.owner_id <> v_user_id)
         or (c.group_id is not null and not public.can_log_to_counter(c.id))
       )
  ) then
    raise exception 'merge_invalid_counters';
  end if;

  v_private_ids := array(select c.id from public.counters c where c.id = any (v_ids) and c.group_id is null);
  -- Contadores de grupo en el orden en que los eligió el usuario (los de enlaces previos, al final).
  v_group_ids := array(
    select c.id from public.counters c
      left join lateral (select array_position(p_counter_ids, c.id) as pos) o on true
     where c.id = any (v_ids) and c.group_id is not null
     order by o.pos nulls last, c.id
  );
  if (select count(distinct c.group_id) from public.counters c where c.id = any (v_group_ids))
     <> coalesce(array_length(v_group_ids, 1), 0) then
    -- Dos contadores del mismo grupo no se pueden enlazar (contarían dos veces en ese grupo).
    raise exception 'merge_same_group';
  end if;

  if coalesce(array_length(v_group_ids, 1), 0) = 0 then
    -- Solo individuales: todo al primero elegido.
    v_target := p_counter_ids[1];
    update public.entries set counter_id = v_target
     where counter_id = any (v_ids) and counter_id <> v_target;
  else
    -- El principal: el que ya lo fuera en un enlace previo o, si no, el primer grupo elegido.
    select l.counter_id into v_target
      from public.counter_links l
     where l.user_id = v_user_id and l.counter_id = any (v_group_ids) and l.is_primary
     limit 1;
    v_target := coalesce(v_target, v_group_ids[1]);

    -- Los registros individuales pasan al principal como solo personales.
    update public.entries
       set counter_id = v_target, personal_only = true, group_only = false
     where counter_id = any (v_private_ids);
  end if;

  -- Carpetas: el resultante entra donde estuviera cualquiera de los fusionados.
  insert into public.folder_counters (folder_id, counter_id)
  select distinct fc.folder_id, v_target
    from public.folder_counters fc
   where fc.counter_id = any (v_ids)
  on conflict do nothing;

  delete from public.counters where id = any (v_private_ids) and id <> v_target;

  -- Enlace entre los contadores de grupo (si hay más de uno).
  delete from public.counter_links where user_id = v_user_id and counter_id = any (v_ids);
  if coalesce(array_length(v_group_ids, 1), 0) > 1 then
    insert into public.counter_links (counter_id, link_id, is_primary)
    select g, v_link, g = v_target from unnest(v_group_ids) as g;
  end if;

  if coalesce(array_length(v_group_ids, 1), 0) > 0 then
    if v_name is not null or v_emoji is not null then
      insert into public.counter_aliases (counter_id, name, emoji)
      values (v_target, v_name, v_emoji)
      on conflict (counter_id, user_id) do update
        set name = coalesce(excluded.name, public.counter_aliases.name),
            emoji = coalesce(excluded.emoji, public.counter_aliases.emoji);
    end if;
  else
    update public.counters
       set name = coalesce(v_name, name), emoji = coalesce(v_emoji, emoji)
     where id = v_target;
  end if;

  return v_target;
end;
$$;

-- Lo mismo que la vista counter_totals, pero solo con los registros que puedo ver según la
-- política de entries: los míos (todos) y, de los demás, los que no son solo personales en
-- contadores de un grupo donde ellos y yo somos miembros activos.
create or replace function public.my_counter_totals()
returns table (
  counter_id uuid,
  total numeric,
  entry_count int,
  last_logged_at timestamptz,
  my_total numeric,
  my_entry_count int,
  my_group_total numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  visible as (
    select e.counter_id, e.user_id, e.amount, e.logged_at, e.personal_only, e.group_only
      from public.entries e, me
     where e.user_id = me.id
    union all
    select e.counter_id, e.user_id, e.amount, e.logged_at, e.personal_only, e.group_only
      from me
      join public.group_members mine
        on mine.user_id = me.id and mine.status = 'active'
      join public.counters c on c.group_id = mine.group_id
      join public.entries e on e.counter_id = c.id
      join public.group_members them
        on them.group_id = c.group_id and them.user_id = e.user_id and them.status = 'active'
     where e.user_id <> me.id
       and not e.personal_only
  )
  select
    v.counter_id,
    coalesce(sum(v.amount) filter (where not v.personal_only), 0),
    (count(*) filter (where v.amount > 0 and not v.personal_only))::int,
    max(v.logged_at),
    coalesce(sum(v.amount) filter (where v.user_id = me.id and not v.group_only), 0),
    (count(*) filter (where v.amount > 0 and v.user_id = me.id and not v.group_only))::int,
    coalesce(sum(v.amount) filter (where v.user_id = me.id and not v.personal_only), 0)
  from visible v, me
  group by v.counter_id;
$$;

-- Contadores enlazados con este (para el usuario actual), el principal primero. Si no está
-- enlazado, solo él mismo.
create or replace function public.my_linked_counters(p_counter_id uuid)
returns table (counter_id uuid, is_primary boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.counter_id, l.is_primary
    from public.counter_links l
   where l.user_id = (select auth.uid())
     and l.link_id = (
       select l2.link_id from public.counter_links l2
        where l2.user_id = (select auth.uid()) and l2.counter_id = p_counter_id
     )
  union all
  select p_counter_id, true
   where not exists (
     select 1 from public.counter_links l3
      where l3.user_id = (select auth.uid()) and l3.counter_id = p_counter_id
   )
  order by 2 desc, 1;
$$;

-- my_time_zone() se usa en los totales diarios, las rachas, las clasificaciones y la gráfica del
-- grupo, dentro de expresiones que se evalúan por cada registro. Al ser SECURITY DEFINER (y con
-- search_path fijo) Postgres no podía «inlinarla» y la ejecutaba una vez por fila, con su
-- búsqueda en profiles. Los perfiles ya los puede leer cualquiera con sesión (política
-- using (true)), así que no necesita privilegios: como función SQL sencilla, Postgres la
-- calcula una sola vez por consulta. Devuelve exactamente lo mismo.
create or replace function public.my_time_zone()
returns text
language sql
stable
security invoker
as $$
  select coalesce(
    (select p.time_zone from public.profiles p where p.id = auth.uid()),
    'Europe/Madrid'
  );
$$;

-- Igual que la política «counters: veo los míos, los de mis grupos y en los que tengo
-- registros»: soy su dueño, es de un grupo del que soy miembro activo o tengo registros en él.
create or replace function public.my_visible_counter_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
    from public.counters c
   where c.owner_id = (select auth.uid())
  union
  select c.id
    from public.group_members m
    join public.counters c on c.group_id = m.group_id
   where m.user_id = (select auth.uid()) and m.status = 'active'
  union
  select e.counter_id
    from public.entries e
   where e.user_id = (select auth.uid());
$$;

-- Admite el código con o sin guion, en minúsculas o con espacios.
create or replace function public.normalize_invite_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function public.notify(
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

create or replace function public.notify_friend_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    perform public.notify(new.requester_id, 'friend_accepted');
    insert into public.notifications (user_id, kind, actor_id, actor_name)
    select new.addressee_id, 'friend_you_accepted', p.id, p.display_name
      from public.profiles p
     where p.id = new.requester_id;
  end if;
  return new;
end;
$$;

-- Avisa a los miembros activos de un grupo, salvo a los de p_except.
create or replace function public.notify_group_members(
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

create or replace function public.notify_kicked()
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

-- Vista previa antes de unirse: nombre del grupo y número de miembros.
create or replace function public.preview_group_by_code(p_code text)
returns table (group_id uuid, name text, member_count int, is_member boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.name,
    (select count(*)::int from public.group_members m
      where m.group_id = g.id and m.status = 'active'),
    exists (select 1 from public.group_members m
      where m.group_id = g.id and m.user_id = (select auth.uid()) and m.status = 'active')
  from public.groups g
  where g.invite_code = public.normalize_invite_code(p_code);
$$;

-- Otro miembro activo al azar (null si no queda nadie más).
create or replace function public.random_group_member(p_group_id uuid, p_except uuid)
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

-- −1 para todos los participantes que siguen en el grupo y tienen al menos 1.
create or replace function public.remove_one_from_common_counter(p_counter_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if not public.can_log_common(p_counter_id) then
    raise exception 'cannot_log_common';
  end if;

  insert into public.entries (counter_id, user_id, amount)
  select p_counter_id, p.user_id, -1
    from public.counter_participants p
    join public.counters c on c.id = p.counter_id
    join public.group_members m
      on m.group_id = c.group_id and m.user_id = p.user_id and m.status = 'active'
   where p.counter_id = p_counter_id
     and (
       select coalesce(sum(e.amount), 0) from public.entries e
        where e.counter_id = p_counter_id and e.user_id = p.user_id
     ) >= 1;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- −1 en cada contador enlazado donde mi parte para el grupo sea al menos 1.
create or replace function public.remove_one_from_counter(p_counter_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_first boolean := true;
  v_part numeric;
  r record;
begin
  for r in select * from public.my_linked_counters(p_counter_id) loop
    continue when not public.can_log_to_counter(r.counter_id);
    select coalesce(sum(e.amount), 0) into v_part
      from public.entries e
     where e.counter_id = r.counter_id
       and e.user_id = (select auth.uid())
       and not e.personal_only;
    continue when v_part < 1;

    insert into public.entries (counter_id, amount, group_only, batch_id)
    values (r.counter_id, -1, not v_first, v_batch);
    v_first := false;
  end loop;
  return not v_first;
end;
$$;

create or replace function public.resign_group_admin(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_successor uuid;
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'No eres el líder de este grupo.';
  end if;
  v_successor := public.random_group_member(p_group_id, (select auth.uid()));
  if v_successor is null then
    raise exception 'Eres el único miembro del grupo: no hay nadie a quien pasarle el liderazgo.';
  end if;
  perform public.set_group_admin(p_group_id, v_successor);
  return v_successor;
end;
$$;

-- Crea (p_folder_id null) o actualiza una carpeta con su lista de contadores, todo de una vez.
-- SECURITY INVOKER: la RLS de arriba decide qué se puede tocar. Devuelve el id de la carpeta.
create or replace function public.save_folder(p_folder_id uuid, p_name text, p_counter_ids uuid[])
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_folder_id uuid := p_folder_id;
begin
  if v_folder_id is null then
    insert into public.folders (name) values (btrim(p_name)) returning id into v_folder_id;
  else
    update public.folders set name = btrim(p_name) where id = v_folder_id;
    if not found then
      raise exception 'folder_not_found';
    end if;
    delete from public.folder_counters where folder_id = v_folder_id;
  end if;

  insert into public.folder_counters (folder_id, counter_id)
  select v_folder_id, unnest(coalesce(p_counter_ids, '{}'::uuid[]))
  on conflict do nothing;

  return v_folder_id;
end;
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

-- Cambia el administrador de un grupo (sin comprobar permisos: lo hacen quienes la llaman).
create or replace function public.set_group_admin(p_group_id uuid, p_new_admin uuid)
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

-- Al aceptar la invitación se apunta la fecha de entrada.
create or replace function public.set_joined_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' and old.status = 'invited' then
    new.joined_at := now();
  end if;
  return new;
end;
$$;

-- La app guarda la zona del móvil. Solo se aceptan zonas que Postgres conoce (si no, fallaría
-- «at time zone»), por eso va por esta función y no con un update directo.
create or replace function public.set_my_time_zone(p_time_zone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then
    raise exception 'Zona horaria no válida: %', p_time_zone;
  end if;
  update public.profiles set time_zone = p_time_zone where id = (select auth.uid());
end;
$$;

-- Día de actividad (racha de uso): el día de quien pulsa, en su hora.
create or replace function public.track_activity_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_activity_days (user_id, day)
  values (
    coalesce((select auth.uid()), new.user_id),
    (now() at time zone public.my_time_zone())::date
  )
  on conflict do nothing;
  return null;
end;
$$;

-- Si alguien sale del grupo (o lo expulsan), sus contadores del grupo pasan al owner del grupo.
create or replace function public.transfer_counters_on_leave()
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

-- Textos de error con «líder».
create or replace function public.transfer_group_admin(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'Solo el líder puede designar a otro.';
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

-- Deshacer: borra lo último que acabo de apuntar en un contador (como mucho de hace 2
-- minutos), con sus copias enlazadas (mismo batch_id) o, en un común que administro, la
-- última tanda sumada a todos.
create or replace function public.undo_last_entry(p_counter_id uuid)
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


-- ===========================================================================
-- 2. Tablas, restricciones, índices y RLS
-- ===========================================================================


create table public.counter_aliases (
  counter_id uuid not null,
  user_id uuid default auth.uid() not null,
  name text,
  emoji text
);

create table public.counter_links (
  user_id uuid default auth.uid() not null,
  counter_id uuid not null,
  link_id uuid not null,
  is_primary boolean default false not null
);

create table public.counter_participants (
  counter_id uuid not null,
  user_id uuid not null
);

create table public.counter_requests (
  id uuid default gen_random_uuid() not null,
  counter_id uuid not null,
  requester_id uuid default auth.uid() not null,
  amount numeric not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null,
  decided_at timestamp with time zone
);

create table public.counters (
  id uuid default gen_random_uuid() not null,
  owner_id uuid default auth.uid() not null,
  name text not null,
  unit text,
  streak_enabled boolean default false not null,
  created_at timestamp with time zone default now() not null,
  emoji text,
  group_id uuid,
  is_common boolean default false not null,
  hidden_from_friends boolean default false not null
);

create table public.entries (
  id uuid default gen_random_uuid() not null,
  counter_id uuid not null,
  user_id uuid default auth.uid() not null,
  amount numeric not null,
  logged_at timestamp with time zone default now() not null,
  note text,
  created_at timestamp with time zone default now() not null,
  personal_only boolean default false not null,
  group_only boolean default false not null,
  batch_id uuid
);

create table public.folder_counters (
  folder_id uuid not null,
  counter_id uuid not null
);

create table public.folders (
  id uuid default gen_random_uuid() not null,
  owner_id uuid default auth.uid() not null,
  name text not null,
  created_at timestamp with time zone default now() not null
);

create table public.friendships (
  id uuid default gen_random_uuid() not null,
  requester_id uuid default auth.uid() not null,
  addressee_id uuid not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null
);

create table public.group_members (
  group_id uuid not null,
  user_id uuid not null,
  role text default 'member'::text not null,
  status text default 'invited'::text not null,
  joined_at timestamp with time zone
);

create table public.groups (
  id uuid default gen_random_uuid() not null,
  name text not null,
  owner_id uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null,
  invite_code text default public.generate_invite_code() not null,
  emoji text,
  photo_path text
);

create table public.hidden_counters (
  user_id uuid default auth.uid() not null,
  counter_id uuid not null
);

create table public.home_removed_counters (
  user_id uuid default auth.uid() not null,
  counter_id uuid not null
);

create table public.notifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  kind text not null,
  actor_id uuid,
  counter_name text,
  group_name text,
  amount numeric,
  created_at timestamp with time zone default now() not null,
  read_at timestamp with time zone,
  actor_name text,
  counter_id uuid,
  visible_from timestamp with time zone default now() not null
);

create table public.profiles (
  id uuid not null,
  username text not null,
  display_name text not null,
  created_at timestamp with time zone default now() not null,
  hide_streak boolean default false not null,
  group_invites text default 'friends'::text not null,
  emoji text,
  photo_path text,
  tutorial_done boolean default false not null,
  time_zone text default 'Europe/Madrid'::text not null,
  hide_counter_totals boolean default false not null
);

create table public.user_activity_days (
  user_id uuid not null,
  day date not null
);

-- Claves primarias, únicas y comprobaciones.

alter table public.counter_aliases add constraint counter_aliases_pkey PRIMARY KEY (counter_id, user_id);
alter table public.counter_aliases add constraint counter_aliases_emoji_check CHECK (((emoji IS NULL) OR ((char_length(emoji) >= 1) AND (char_length(emoji) <= 10))));
alter table public.counter_aliases add constraint counter_aliases_name_check CHECK (((name IS NULL) OR ((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 60))));

alter table public.counter_links add constraint counter_links_pkey PRIMARY KEY (user_id, counter_id);

alter table public.counter_participants add constraint counter_participants_pkey PRIMARY KEY (counter_id, user_id);

alter table public.counter_requests add constraint counter_requests_pkey PRIMARY KEY (id);
alter table public.counter_requests add constraint counter_requests_amount_check CHECK (((amount <> (0)::numeric) AND (abs(amount) < (1000000000)::numeric)));
alter table public.counter_requests add constraint counter_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));

alter table public.counters add constraint counters_pkey PRIMARY KEY (id);
alter table public.counters add constraint counters_emoji_check CHECK (((emoji IS NULL) OR ((char_length(emoji) >= 1) AND (char_length(emoji) <= 10))));
alter table public.counters add constraint counters_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 60)));
alter table public.counters add constraint counters_unit_check CHECK (((unit IS NULL) OR ((char_length(btrim(unit)) >= 1) AND (char_length(btrim(unit)) <= 30))));

alter table public.entries add constraint entries_pkey PRIMARY KEY (id);
alter table public.entries add constraint entries_amount_check CHECK (((amount <> (0)::numeric) AND (abs(amount) < (1000000000)::numeric)));
alter table public.entries add constraint entries_flags_check CHECK ((NOT (personal_only AND group_only)));
alter table public.entries add constraint entries_note_check CHECK (((note IS NULL) OR (char_length(note) <= 200)));

alter table public.folder_counters add constraint folder_counters_pkey PRIMARY KEY (folder_id, counter_id);

alter table public.folders add constraint folders_pkey PRIMARY KEY (id);
alter table public.folders add constraint folders_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 30)));

alter table public.friendships add constraint friendships_pkey PRIMARY KEY (id);
alter table public.friendships add constraint friendships_no_self CHECK ((requester_id <> addressee_id));
alter table public.friendships add constraint friendships_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])));

alter table public.group_members add constraint group_members_pkey PRIMARY KEY (group_id, user_id);
alter table public.group_members add constraint group_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text])));
alter table public.group_members add constraint group_members_status_check CHECK ((status = ANY (ARRAY['invited'::text, 'active'::text])));

alter table public.groups add constraint groups_pkey PRIMARY KEY (id);
alter table public.groups add constraint groups_invite_code_key UNIQUE (invite_code);
alter table public.groups add constraint groups_emoji_check CHECK (((emoji IS NULL) OR ((char_length(emoji) >= 1) AND (char_length(emoji) <= 10))));
alter table public.groups add constraint groups_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 50)));
alter table public.groups add constraint groups_photo_path_check CHECK (((photo_path IS NULL) OR (char_length(photo_path) <= 200)));

alter table public.hidden_counters add constraint hidden_counters_pkey PRIMARY KEY (user_id, counter_id);

alter table public.home_removed_counters add constraint home_removed_counters_pkey PRIMARY KEY (user_id, counter_id);

alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.notifications add constraint notifications_kind_check CHECK ((kind = ANY (ARRAY['friend_accepted'::text, 'friend_you_accepted'::text, 'request_approved'::text, 'request_rejected'::text, 'counter_deleted'::text, 'group_deleted'::text, 'group_admin'::text, 'member_left'::text, 'new_leader'::text, 'you_are_leader'::text, 'kicked'::text, 'group_activity'::text])));

alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_username_key UNIQUE (username);
alter table public.profiles add constraint profiles_display_name_check CHECK (((char_length(btrim(display_name)) >= 1) AND (char_length(btrim(display_name)) <= 50)));
alter table public.profiles add constraint profiles_emoji_check CHECK (((emoji IS NULL) OR ((char_length(emoji) >= 1) AND (char_length(emoji) <= 10))));
alter table public.profiles add constraint profiles_group_invites_check CHECK ((group_invites = ANY (ARRAY['friends'::text, 'nobody'::text])));
alter table public.profiles add constraint profiles_photo_path_check CHECK (((photo_path IS NULL) OR (char_length(photo_path) <= 200)));
alter table public.profiles add constraint profiles_username_check CHECK ((username ~ '^[a-z0-9_]{3,20}$'::text));

alter table public.user_activity_days add constraint user_activity_days_pkey PRIMARY KEY (user_id, day);

-- Claves foráneas.

alter table public.counter_aliases add constraint counter_aliases_counter_id_fkey FOREIGN KEY (counter_id) REFERENCES public.counters(id) ON DELETE CASCADE;
alter table public.counter_aliases add constraint counter_aliases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.counter_links add constraint counter_links_counter_id_fkey FOREIGN KEY (counter_id) REFERENCES public.counters(id) ON DELETE CASCADE;
alter table public.counter_links add constraint counter_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.counter_participants add constraint counter_participants_counter_id_fkey FOREIGN KEY (counter_id) REFERENCES public.counters(id) ON DELETE CASCADE;
alter table public.counter_participants add constraint counter_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.counter_requests add constraint counter_requests_counter_id_fkey FOREIGN KEY (counter_id) REFERENCES public.counters(id) ON DELETE CASCADE;
alter table public.counter_requests add constraint counter_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.counters add constraint counters_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;
alter table public.counters add constraint counters_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.entries add constraint entries_counter_id_fkey FOREIGN KEY (counter_id) REFERENCES public.counters(id) ON DELETE CASCADE;
alter table public.entries add constraint entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.folder_counters add constraint folder_counters_counter_id_fkey FOREIGN KEY (counter_id) REFERENCES public.counters(id) ON DELETE CASCADE;
alter table public.folder_counters add constraint folder_counters_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE CASCADE;
alter table public.folders add constraint folders_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.friendships add constraint friendships_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.friendships add constraint friendships_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.group_members add constraint group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;
alter table public.group_members add constraint group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.groups add constraint groups_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.hidden_counters add constraint hidden_counters_counter_id_fkey FOREIGN KEY (counter_id) REFERENCES public.counters(id) ON DELETE CASCADE;
alter table public.hidden_counters add constraint hidden_counters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.home_removed_counters add constraint home_removed_counters_counter_id_fkey FOREIGN KEY (counter_id) REFERENCES public.counters(id) ON DELETE CASCADE;
alter table public.home_removed_counters add constraint home_removed_counters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_counter_id_fkey FOREIGN KEY (counter_id) REFERENCES public.counters(id) ON DELETE CASCADE;
alter table public.notifications add constraint notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.user_activity_days add constraint user_activity_days_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Índices.

CREATE INDEX counter_aliases_user_idx ON public.counter_aliases USING btree (user_id);
CREATE INDEX counter_links_counter_idx ON public.counter_links USING btree (counter_id);
CREATE INDEX counter_links_link_idx ON public.counter_links USING btree (link_id);
CREATE INDEX counter_participants_user_idx ON public.counter_participants USING btree (user_id);
CREATE INDEX counter_requests_counter_idx ON public.counter_requests USING btree (counter_id, status);
CREATE INDEX counter_requests_requester_idx ON public.counter_requests USING btree (requester_id, status);
CREATE INDEX counters_group_idx ON public.counters USING btree (group_id);
CREATE INDEX counters_owner_idx ON public.counters USING btree (owner_id);
CREATE INDEX entries_batch_idx ON public.entries USING btree (batch_id) WHERE (batch_id IS NOT NULL);
CREATE INDEX entries_counter_logged_idx ON public.entries USING btree (counter_id, logged_at);
CREATE INDEX entries_user_counter_idx ON public.entries USING btree (user_id, counter_id);
CREATE INDEX entries_user_logged_idx ON public.entries USING btree (user_id, logged_at);
CREATE INDEX folder_counters_counter_idx ON public.folder_counters USING btree (counter_id);
CREATE INDEX folders_owner_idx ON public.folders USING btree (owner_id);
CREATE INDEX friendships_addressee_idx ON public.friendships USING btree (addressee_id);
CREATE UNIQUE INDEX friendships_pair_idx ON public.friendships USING btree (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX friendships_requester_idx ON public.friendships USING btree (requester_id);
CREATE INDEX group_members_group_status_idx ON public.group_members USING btree (group_id, status, user_id);
CREATE INDEX group_members_user_idx ON public.group_members USING btree (user_id);
CREATE INDEX groups_owner_idx ON public.groups USING btree (owner_id);
CREATE INDEX hidden_counters_counter_idx ON public.hidden_counters USING btree (counter_id);
CREATE INDEX home_removed_counters_counter_idx ON public.home_removed_counters USING btree (counter_id);
CREATE INDEX notifications_actor_idx ON public.notifications USING btree (actor_id);
CREATE INDEX notifications_counter_idx ON public.notifications USING btree (counter_id);
CREATE INDEX notifications_pending_idx ON public.notifications USING btree (counter_id, actor_id, visible_from) WHERE (kind = 'group_activity'::text);
CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, created_at DESC);

-- RLS activada en todas las tablas.

alter table public.counter_aliases enable row level security;
alter table public.counter_links enable row level security;
alter table public.counter_participants enable row level security;
alter table public.counter_requests enable row level security;
alter table public.counters enable row level security;
alter table public.entries enable row level security;
alter table public.folder_counters enable row level security;
alter table public.folders enable row level security;
alter table public.friendships enable row level security;
alter table public.group_members enable row level security;
alter table public.groups enable row level security;
alter table public.hidden_counters enable row level security;
alter table public.home_removed_counters enable row level security;
alter table public.notifications enable row level security;
alter table public.profiles enable row level security;
alter table public.user_activity_days enable row level security;


-- ===========================================================================
-- 3. Vistas (security_invoker: respetan la RLS de quien consulta)
-- ===========================================================================


-- total / entry_count:   lo que cuenta en el contador (en uno de grupo, para el grupo).
-- my_total / my_entry_count: lo mío para mis estadísticas (sin copias group_only).
-- my_group_total:        lo mío que cuenta para el grupo (decide el −1).
create or replace view public.counter_totals
with (security_invoker = true)
as
select
  e.counter_id,
  coalesce(sum(e.amount) filter (where not e.personal_only), 0) as total,
  (count(*) filter (where e.amount > 0 and not e.personal_only))::int as entry_count,
  max(e.logged_at) as last_logged_at,
  coalesce(
    sum(e.amount) filter (where e.user_id = (select auth.uid()) and not e.group_only),
    0
  ) as my_total,
  (count(*) filter (
    where e.amount > 0 and e.user_id = (select auth.uid()) and not e.group_only
  ))::int as my_entry_count,
  coalesce(
    sum(e.amount) filter (where e.user_id = (select auth.uid()) and not e.personal_only),
    0
  ) as my_group_total
from public.entries e
group by e.counter_id;

-- Totales diarios (Estadísticas).
create or replace view public.entry_daily_totals
with (security_invoker = true)
as
select
  e.counter_id,
  e.user_id,
  (e.logged_at at time zone public.my_time_zone())::date as day,
  sum(e.amount) as total,
  (count(*) filter (where e.amount > 0))::int as entry_count
from public.entries e
where not e.group_only
group by e.counter_id, e.user_id, (e.logged_at at time zone public.my_time_zone())::date;

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


-- ===========================================================================
-- 4. Políticas de RLS
-- ===========================================================================


create policy "counter_aliases: cada uno los suyos"
  on public.counter_aliases for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "counter_links: cada uno los suyos"
  on public.counter_links for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Los ven los miembros del grupo del contador. Se escriben solo con las funciones de abajo.
create policy "counter_participants: los ven los miembros del grupo"
  on public.counter_participants for select
  to authenticated
  using (
    exists (
      select 1 from public.counters c
      where c.id = counter_id and c.group_id is not null and public.is_group_member(c.group_id)
    )
  );

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

create policy "counters: creo privados o en mis grupos"
  on public.counters for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (group_id is null or public.is_group_member(group_id))
  );

create policy "counters: edita el dueño o el administrador"
  on public.counters for update
  to authenticated
  using (
    (group_id is null and owner_id = (select auth.uid()))
    or (group_id is not null and public.is_counter_admin(id))
  );

create policy "counters: solo se borran los privados, por su dueño"
  on public.counters for delete
  to authenticated
  using (group_id is null and owner_id = (select auth.uid()));

create policy "counters: veo los míos, los de mis grupos y en los que tengo registros"
  on public.counters for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or (group_id is not null and public.is_group_member(group_id))
    or public.has_entries_in_counter(id)
  );

create policy "entries: borro las mías"
  on public.entries for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "entries: edito las mías"
  on public.entries for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_log_to_counter(counter_id));

create policy "entries: inserto las mías en contadores permitidos"
  on public.entries for insert
  to authenticated
  with check (user_id = (select auth.uid()) and public.can_log_to_counter(counter_id));

create policy "entries: veo las mías y las de mi grupo en contadores compartidos"
  on public.entries for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (not personal_only and public.can_view_group_entry(counter_id, user_id))
  );

-- Solo en mis carpetas, y solo con contadores que puedo ver (la subconsulta respeta la RLS de
-- counters).
create policy "folder_counters: en mis carpetas"
  on public.folder_counters for all
  to authenticated
  using (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = (select auth.uid()))
    and exists (select 1 from public.counters c where c.id = counter_id)
  );

create policy "folders: cada uno las suyas"
  on public.folders for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Cualquiera de los dos puede borrarla: cancelar una solicitud o dejar de ser amigos.
create policy "friendships: cualquiera de los dos la borra"
  on public.friendships for delete
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- Solo el destinatario responde. Solo puede tocar la columna status (ver grants al final).
create policy "friendships: el destinatario acepta o rechaza"
  on public.friendships for update
  to authenticated
  using (addressee_id = (select auth.uid()) and status = 'pending')
  with check (addressee_id = (select auth.uid()) and status in ('accepted', 'rejected'));

create policy "friendships: envío solicitudes en mi nombre"
  on public.friendships for insert
  to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');

create policy "friendships: veo las que me implican"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- El invitado acepta su invitación (invited → active). Solo puede tocar status.
create policy "group_members: el invitado acepta"
  on public.group_members for update
  to authenticated
  using (user_id = (select auth.uid()) and status = 'invited')
  with check (user_id = (select auth.uid()) and status = 'active');

-- El owner expulsa a otros (o retira invitaciones); cada miembro puede salir o rechazar su
-- invitación. El owner no puede salir: debe borrar el grupo.
create policy "group_members: el owner expulsa y cada uno sale"
  on public.group_members for delete
  to authenticated
  using (
    (public.is_group_owner(group_id) and role <> 'owner')
    or (user_id = (select auth.uid()) and role <> 'owner')
  );

create policy "group_members: el owner invita a sus amigos"
  on public.group_members for insert
  to authenticated
  with check (
    public.is_group_owner(group_id)
    and role = 'member'
    and status = 'invited'
    and public.are_friends((select auth.uid()), user_id)
    and exists (
      select 1 from public.profiles p
       where p.id = user_id and p.group_invites = 'friends'
    )
  );

-- Los miembros activos ven a todos; un invitado solo ve su propia fila (su invitación).
create policy "group_members: lectura para miembros y la propia invitación"
  on public.group_members for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_group_member(group_id));

create policy "groups: cualquiera crea grupos propios"
  on public.groups for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "groups: el owner lo borra"
  on public.groups for delete
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "groups: el owner lo renombra"
  on public.groups for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- groups ----------------------------------------------------------------------
create policy "groups: lo ven sus miembros e invitados"
  on public.groups for select
  to authenticated
  using (public.is_group_participant(id) or owner_id = (select auth.uid()));

create policy "hidden_counters: cada uno los suyos"
  on public.hidden_counters for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "home_removed_counters: cada uno los suyos"
  on public.home_removed_counters for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "notifications: cada uno las suyas"
  on public.notifications for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and visible_from <= now()
    and not (kind = 'group_activity' and amount = 0)
  );

create policy "notifications: cada uno marca las suyas como leídas"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()) and visible_from <= now())
  with check (user_id = (select auth.uid()));

-- Solo yo edito mi perfil. No hay política de insert ni delete: lo hacen el trigger y el borrado
-- en cascada desde auth.users.
create policy "profiles: cada uno edita el suyo"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Cualquier usuario con sesión puede ver perfiles (todos los campos son públicos: no hay email).
create policy "profiles: lectura para usuarios autenticados"
  on public.profiles for select
  to authenticated
  using (true);

create policy "user_activity_days: cada uno los suyos"
  on public.user_activity_days for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "group-photos: las borra el owner"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'group-photos'
    and public.is_group_owner(public.group_id_from_path(name))
  );

create policy "group-photos: las cambia el owner"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'group-photos'
    and public.is_group_owner(public.group_id_from_path(name))
  );

create policy "group-photos: las sube el owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'group-photos'
    and public.is_group_owner(public.group_id_from_path(name))
  );

create policy "group-photos: las ven los del grupo"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'group-photos'
    and public.is_group_participant(public.group_id_from_path(name))
  );

create policy "profile-photos: cada uno borra las suyas"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );

create policy "profile-photos: cada uno cambia las suyas"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );

create policy "profile-photos: cada uno sube las suyas"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );

create policy "profile-photos: las ven los usuarios con sesión"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'profile-photos');


-- ===========================================================================
-- 5. Triggers
-- ===========================================================================


create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_entry_group_activity
  after insert or update or delete on public.entries
  for each row execute function public.on_entry_group_activity();

-- Una vez por sentencia y usuario bastaría, pero por fila es más simple y el insert es idempotente.
create trigger on_entry_track_activity
  after insert on public.entries
  for each row execute function public.track_activity_day();

create trigger on_friendship_accepted
  after update on public.friendships
  for each row execute function public.notify_friend_accepted();

create trigger on_group_member_accepted
  before update on public.group_members
  for each row execute function public.set_joined_at();

create trigger on_group_member_kicked
  after delete on public.group_members
  for each row execute function public.notify_kicked();

create trigger on_group_member_left
  after delete on public.group_members
  for each row execute function public.transfer_counters_on_leave();

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

create trigger on_group_deleted
  before delete on public.groups
  for each row execute function public.dissolve_group_counters_on_delete();


-- ===========================================================================
-- 6. Permisos
-- ===========================================================================


-- Supabase da por defecto todos los permisos a anon y authenticated: se quitan y se dan solo
-- los necesarios. anon (sin sesión) solo puede comprobar si un nombre de usuario está libre.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, emoji, group_invites, hide_counter_totals, hide_streak, photo_path,
  tutorial_done, username) on public.profiles to authenticated;

grant select, insert, delete on public.counters to authenticated;
grant update (emoji, hidden_from_friends, name, streak_enabled, unit)
  on public.counters to authenticated;
grant select, insert, update, delete on public.entries to authenticated;

grant select, insert, delete on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;

-- groups.invite_code no se puede leer directamente (solo con get_group_invite_code).
grant select (created_at, emoji, id, name, owner_id, photo_path) on public.groups to authenticated;
grant insert, delete on public.groups to authenticated;
grant update (emoji, name, photo_path) on public.groups to authenticated;
grant select, insert, delete on public.group_members to authenticated;
grant update (status) on public.group_members to authenticated;

grant select on public.counter_participants to authenticated;
grant select, insert, delete on public.folders to authenticated;
grant update (name) on public.folders to authenticated;
grant select, insert, delete on public.folder_counters to authenticated;
grant select, insert, update, delete on public.counter_aliases to authenticated;
grant select, insert, delete on public.counter_links to authenticated;
grant select on public.user_activity_days to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert on public.counter_requests to authenticated;
grant select, insert, delete on public.hidden_counters to authenticated;
grant select, insert, delete on public.home_removed_counters to authenticated;

grant select on public.counter_totals, public.entry_daily_totals, public.my_counter_streaks
  to authenticated;

-- Funciones que se pueden llamar por la API (las de trigger y las internas, ninguna).
grant execute on function public.add_to_common_counter(uuid, numeric, timestamptz, text) to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.can_log_common(uuid) to authenticated;
grant execute on function public.can_log_to_counter(uuid) to authenticated;
grant execute on function public.can_view_group_entry(uuid, uuid) to authenticated;
grant execute on function public.decide_counter_request(uuid, boolean) to authenticated;
grant execute on function public.delete_group_counter(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.generate_invite_code() to authenticated;
grant execute on function public.get_friends_streaks() to authenticated;
grant execute on function public.get_group_counter_daily(uuid) to authenticated;
grant execute on function public.get_group_invite_code(uuid) to authenticated;
grant execute on function public.get_leaderboard(uuid, text) to authenticated;
grant execute on function public.get_my_home() to authenticated;
grant execute on function public.get_streak_leaderboard(uuid) to authenticated;
grant execute on function public.get_user_counters(uuid) to authenticated;
grant execute on function public.group_id_from_path(text) to public;
grant execute on function public.has_entries_in_counter(uuid) to authenticated;
grant execute on function public.is_counter_admin(uuid) to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.is_group_participant(uuid) to authenticated;
grant execute on function public.is_username_available(text) to anon, authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.log_to_counter(uuid, numeric, timestamptz, text) to authenticated;
grant execute on function public.merge_counters(uuid[], text, text) to authenticated;
grant execute on function public.my_counter_totals() to authenticated;
grant execute on function public.my_linked_counters(uuid) to authenticated;
grant execute on function public.my_time_zone() to public;
grant execute on function public.my_visible_counter_ids() to authenticated;
grant execute on function public.normalize_invite_code(text) to public;
grant execute on function public.preview_group_by_code(text) to authenticated;
grant execute on function public.remove_one_from_common_counter(uuid) to authenticated;
grant execute on function public.remove_one_from_counter(uuid) to authenticated;
grant execute on function public.resign_group_admin(uuid) to authenticated;
grant execute on function public.save_folder(uuid, text, uuid[]) to authenticated;
grant execute on function public.set_counter_participants(uuid, uuid[]) to authenticated;
grant execute on function public.set_my_time_zone(text) to authenticated;
grant execute on function public.transfer_group_admin(uuid, uuid) to authenticated;
grant execute on function public.undo_last_entry(uuid) to authenticated;


-- ===========================================================================
-- 7. Storage: fotos de grupo y de perfil (privadas, máx. 2 MB)
-- ===========================================================================


insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('group-photos', 'group-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('profile-photos', 'profile-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Las políticas de storage.objects están en el apartado 4.

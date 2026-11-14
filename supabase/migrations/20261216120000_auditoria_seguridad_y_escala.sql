-- Correcciones de la auditoría del 2026-11-14 (seguridad y escala). Ver docs/auditoria/.
--
-- A-001  Cupo diario de resúmenes de teléfono en get_friend_suggestions: ya no se pueden
--        recorrer todos los números para saber el teléfono de cada usuario.
-- A-003  Nadie escribe directamente en entries: solo las funciones (+N, −1, fusionar…). Desde la
--        app solo se edita cantidad, fecha y nota de lo propio, sin cambiar el signo.
-- A-013  Al expulsar a alguien el grupo estrena código de invitación.
-- A-009  Como mucho 50 avisos por usuario (se borran los más antiguos).
-- A-008, A-010, A-011, A-012  Totales diarios y gráfica del grupo en una sola petición (JSON, sin
--        el límite de 1000 filas), clasificaciones sin una función ni la zona horaria por cada
--        registro, y las rachas de mis contadores partiendo de mis registros.
-- Compatible con la versión anterior de la app; lo que esta ya no usa se borra en la siguiente
-- migración (20261216130000).

-- ---------------------------------------------------------------------------------------------
-- A-001: cupo de resúmenes de la agenda
-- ---------------------------------------------------------------------------------------------

create table public.contact_lookups (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null default current_date,
  phone_hash text not null,
  primary key (user_id, phone_hash)
);
alter table public.contact_lookups enable row level security;
revoke all on public.contact_lookups from anon, authenticated;

create or replace function public.get_friend_suggestions(
  p_contact_hashes text[] default '{}',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  display_name text,
  emoji text,
  photo_path text,
  is_contact boolean,
  mutual_count integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_me uuid := (select auth.uid());
  v_hashes text[];
  v_used int;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  v_hashes := array(
    select distinct h from unnest(coalesce(p_contact_hashes[1:3000], '{}')) h
     where h ~ '^[0-9a-f]{64}$'
  );

  -- Cupo: como mucho 3000 resúmenes distintos al día por usuario. Volver a mandar la misma
  -- agenda no gasta nada; recorrer todos los números posibles llevaría siglos.
  delete from public.contact_lookups where user_id = v_me and day < current_date;
  select count(*) into v_used from public.contact_lookups where user_id = v_me;
  insert into public.contact_lookups (user_id, day, phone_hash)
  select v_me, current_date, h
    from unnest(v_hashes) h
   where not exists (
     select 1 from public.contact_lookups l where l.user_id = v_me and l.phone_hash = h
   )
   limit greatest(3000 - v_used, 0)
  on conflict do nothing;

  return query
  with me as (
    select v_me as uid
  ),
  related as (
    -- Cualquiera con quien ya tengo una amistad o una solicitud (en cualquier estado).
    select case when f.requester_id = me.uid then f.addressee_id else f.requester_id end as uid
    from public.friendships f, me
    where me.uid in (f.requester_id, f.addressee_id)
  ),
  my_friends as (
    select case when f.requester_id = me.uid then f.addressee_id else f.requester_id end as uid
    from public.friendships f, me
    where f.status = 'accepted' and me.uid in (f.requester_id, f.addressee_id)
  ),
  contacts as (
    -- Solo los resúmenes que caben en mi cupo de hoy (ver arriba).
    select distinct d.user_id as uid
    from public.phone_directory d
    join public.contact_lookups l
      on l.user_id = v_me and l.phone_hash = d.phone_hash
    where d.phone_hash = any (v_hashes)
  ),
  friends_of_friends as (
    select
      case when f.requester_id = mf.uid then f.addressee_id else f.requester_id end as uid,
      count(*)::integer as mutual
    from my_friends mf
    join public.friendships f
      on f.status = 'accepted' and mf.uid in (f.requester_id, f.addressee_id)
    group by 1
  ),
  candidates as (
    select uid from contacts
    union
    select uid from friends_of_friends
  )
  select
    p.id,
    p.username,
    p.display_name,
    p.emoji,
    p.photo_path,
    (c.uid is not null) as is_contact,
    coalesce(fof.mutual, 0) as mutual_count
  from candidates cand
  join public.profiles p on p.id = cand.uid
  left join contacts c on c.uid = cand.uid
  left join friends_of_friends fof on fof.uid = cand.uid
  where cand.uid <> (select uid from me)
    and cand.uid not in (select uid from related)
  order by (c.uid is not null) desc, coalesce(fof.mutual, 0) desc, p.display_name
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.get_friend_suggestions(text[], integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_friend_suggestions(text[], integer, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- A-003: entries solo se escribe con las funciones
-- ---------------------------------------------------------------------------------------------

revoke insert, update on public.entries from authenticated;
grant update (amount, logged_at, note) on public.entries to authenticated;

-- Editar un registro nunca le cambia el signo (un +N no pasa a ser una resta, ni al revés).
create or replace function public.keep_entry_sign()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if sign(new.amount) <> sign(old.amount) then
    raise exception 'invalid_amount';
  end if;
  return new;
end;
$$;
revoke all on function public.keep_entry_sign() from public, anon, authenticated;

create trigger keep_entry_sign
before update of amount on public.entries
for each row execute function public.keep_entry_sign();

-- Las tres funciones que insertaban o movían registros con los permisos de quien llama pasan a
-- SECURITY DEFINER con las mismas comprobaciones (y fusionar, además, solo toca lo mío).
create or replace function public.log_to_counter(
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

create or replace function public.remove_one_from_counter(p_counter_id uuid)
returns boolean
language plpgsql
security definer
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

create or replace function public.merge_counters(p_counter_ids uuid[], p_name text, p_emoji text)
returns uuid
language plpgsql
security definer
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
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

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
     where counter_id = any (v_ids) and counter_id <> v_target and user_id = v_user_id;
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
     where counter_id = any (v_private_ids) and user_id = v_user_id;
  end if;

  -- Carpetas: el resultante entra donde estuviera cualquiera de los fusionados.
  insert into public.folder_counters (folder_id, counter_id)
  select distinct fc.folder_id, v_target
    from public.folder_counters fc
    join public.folders f on f.id = fc.folder_id and f.owner_id = v_user_id
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

-- ---------------------------------------------------------------------------------------------
-- A-013: código nuevo al expulsar
-- ---------------------------------------------------------------------------------------------

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
  -- El grupo estrena código: con el antiguo, el expulsado podría volver a entrar al momento.
  for i in 1..5 loop
    begin
      update public.groups set invite_code = public.generate_invite_code()
       where id = old.group_id;
      exit;
    exception when unique_violation then
      null; -- Código repetido (muy raro): se prueba otro.
    end;
  end loop;
  insert into public.notifications (user_id, kind, actor_id, actor_name, group_name)
  select old.user_id, 'kicked', p.id, p.display_name, v_group_name
    from public.profiles p
   where p.id = (select auth.uid());
  return null;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- A-009: como mucho 50 avisos por usuario
-- ---------------------------------------------------------------------------------------------

create or replace function public.trim_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications n
   where n.id in (
     select x.id from public.notifications x
      where x.user_id = new.user_id
      order by x.created_at desc, x.id desc
      offset 50
   );
  return null;
end;
$$;
revoke all on function public.trim_notifications() from public, anon, authenticated;

create trigger trim_notifications
after insert on public.notifications
for each row execute function public.trim_notifications();

delete from public.notifications n
 where n.id in (
   select x.id from (
     select id, row_number() over (partition by user_id order by created_at desc, id desc) as rn
       from public.notifications
   ) x
   where x.rn > 50
 );

-- ---------------------------------------------------------------------------------------------
-- A-008: mis totales diarios en una sola petición
-- ---------------------------------------------------------------------------------------------

create or replace function public.get_my_daily_totals()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_tz text := public.my_time_zone();
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  return coalesce((
    select json_agg(json_build_object(
             'counter_id', d.counter_id, 'day', d.day, 'total', d.total,
             'entry_count', d.entry_count
           ) order by d.day, d.counter_id)
      from (
        select e.counter_id,
               (e.logged_at at time zone v_tz)::date as day,
               sum(e.amount) as total,
               (count(*) filter (where e.amount > 0))::int as entry_count
          from public.entries e
         where e.user_id = v_me and not e.group_only
         group by 1, 2
      ) d
  ), '[]'::json);
end;
$$;
revoke all on function public.get_my_daily_totals() from public, anon, authenticated;
grant execute on function public.get_my_daily_totals() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- A-010 / A-011: gráfica y clasificaciones del grupo
-- ---------------------------------------------------------------------------------------------

-- Lo que sumó cada miembro activo cada día. JSON: una lista de filas se cortaba en 1000 y, al ir
-- del día más antiguo al más reciente, se perdían los últimos días.
create or replace function public.get_group_counter_days(p_counter_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_tz text := public.my_time_zone();
begin
  select c.group_id into v_group_id from public.counters c where c.id = p_counter_id;
  if v_group_id is null or not public.is_group_member(v_group_id) then
    raise exception 'not_shared_counter';
  end if;

  return coalesce((
    select json_agg(json_build_object('user_id', d.user_id, 'day', d.day, 'total', d.total)
                    order by d.day, d.user_id)
      from (
        select e.user_id, (e.logged_at at time zone v_tz)::date as day, sum(e.amount) as total
          from public.entries e
          join public.group_members m
            on m.group_id = v_group_id and m.user_id = e.user_id and m.status = 'active'
         where e.counter_id = p_counter_id and not e.personal_only
         group by 1, 2
      ) d
  ), '[]'::json);
end;
$$;
revoke all on function public.get_group_counter_days(uuid) from public, anon, authenticated;
grant execute on function public.get_group_counter_days(uuid) to authenticated;

-- Clasificación por periodo. SECURITY DEFINER: ya comprueba que soy miembro activo y solo suma a
-- los miembros activos (lo mismo que hacía la RLS, pero sin una función por cada registro). La
-- zona horaria se calcula una vez y el inicio del periodo se compara con logged_at tal cual.
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
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_tz text := public.my_time_zone();
  v_start timestamptz;
begin
  if period not in ('week', 'month', 'year', 'all') then
    raise exception 'invalid_period';
  end if;

  select c.group_id into v_group_id from public.counters c where c.id = get_leaderboard.counter_id;
  if v_group_id is null or not public.is_group_member(v_group_id) then
    raise exception 'not_shared_counter';
  end if;

  if period <> 'all' then
    v_start := date_trunc(period, now() at time zone v_tz) at time zone v_tz;
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
   and (v_start is null or e.logged_at >= v_start)
  where m.group_id = v_group_id and m.status = 'active'
  group by m.user_id, p.username, p.display_name
  order by 6, 3;
end;
$$;

-- Rachas de un contador de grupo: igual, solo con los miembros activos y la zona una vez.
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
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_tz text := public.my_time_zone();
  v_today date;
begin
  select c.group_id into v_group_id from public.counters c where c.id = p_counter_id;
  if v_group_id is null or not public.is_group_member(v_group_id) then
    raise exception 'not_shared_counter';
  end if;
  v_today := (now() at time zone v_tz)::date;

  return query
  with days as (
    select e.user_id,
           (e.logged_at at time zone v_tz)::date as day,
           sum(e.amount) as amount
      from public.entries e
      join public.group_members m
        on m.group_id = v_group_id and m.user_id = e.user_id and m.status = 'active'
     where e.counter_id = p_counter_id and not e.personal_only
     group by 1, 2
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
  per_user as (
    select r.user_id,
           coalesce(max(r.days) filter (where r.end_day >= v_today - 1), 0) as current_days,
           max(r.days) as best_days
      from runs r
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

-- ---------------------------------------------------------------------------------------------
-- A-012: las rachas de mis contadores parten de mis registros (antes recorría todos los
-- contadores de la base de datos con dos funciones por cada uno) y la zona horaria va una vez.
-- ---------------------------------------------------------------------------------------------

create or replace view public.my_counter_streaks
with (security_invoker = true) as
with tz as (
  select public.my_time_zone() as tz
),
mine as materialized (
  select e.counter_id, e.logged_at, e.amount
    from public.entries e
   where e.user_id = (select auth.uid())
     and not e.group_only
),
days as (
  select m.counter_id,
         (m.logged_at at time zone tz.tz)::date as day,
         sum(m.amount) as amount
    from mine m
    cross join tz
   where m.counter_id in (select c.id from public.counters c where c.streak_enabled)
   group by 1, 2
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
  select (now() at time zone tz.tz)::date as d from tz
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

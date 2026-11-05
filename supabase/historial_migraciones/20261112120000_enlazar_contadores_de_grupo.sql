-- Fusionar varios contadores de grupo (petición del usuario).
--
-- Cada grupo necesita su propio contador, así que no se unen en la base de datos: se ENLAZAN
-- solo para el usuario que fusiona (counter_links). Para él son un único contador:
-- * Al registrar se inserta una copia en cada contador enlazado (mismo batch_id) para que sume
--   en cada grupo. Solo la primera cuenta para sus estadísticas; las demás son group_only.
-- * Sus estadísticas suman todo lo que había en cada contador + lo nuevo una sola vez.
-- * Cada grupo conserva lo que tenía y suma lo nuevo desde la fusión. Nadie ve lo de otro grupo.
-- * Editar o borrar un registro cambia todas sus copias (mismo batch_id).
--
-- Columnas de entries:
--   personal_only: solo para mis estadísticas (registros privados movidos a un contador de grupo).
--   group_only:    solo para el grupo (copias de un registro enlazado).

alter table public.entries add column group_only boolean not null default false;
alter table public.entries add column batch_id uuid;
alter table public.entries add constraint entries_flags_check
  check (not (personal_only and group_only));
create index entries_batch_idx on public.entries (batch_id) where batch_id is not null;

-- ---------------------------------------------------------------------------
-- Totales
-- ---------------------------------------------------------------------------

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

-- Las estadísticas personales no cuentan las copias para otros grupos.
create or replace view public.entry_daily_totals
with (security_invoker = true)
as
select
  e.counter_id,
  e.user_id,
  (e.logged_at at time zone 'Europe/Madrid')::date as day,
  sum(e.amount) as total,
  (count(*) filter (where e.amount > 0))::int as entry_count
from public.entries e
where not e.group_only
group by e.counter_id, e.user_id, (e.logged_at at time zone 'Europe/Madrid')::date;

-- ---------------------------------------------------------------------------
-- Enlaces (personales)
-- ---------------------------------------------------------------------------

create table public.counter_links (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  counter_id uuid not null references public.counters (id) on delete cascade,
  link_id uuid not null,
  is_primary boolean not null default false,
  primary key (user_id, counter_id)
);

create index counter_links_link_idx on public.counter_links (link_id);

alter table public.counter_links enable row level security;

create policy "counter_links: cada uno los suyos"
  on public.counter_links for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.counter_links from anon, authenticated;
grant select, insert, delete on public.counter_links to authenticated;

-- Contadores enlazados con este (para el usuario actual), el principal primero. Si no está
-- enlazado, solo él mismo.
create function public.my_linked_counters(p_counter_id uuid)
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

-- ---------------------------------------------------------------------------
-- Registrar y restar (en todos los enlazados)
-- ---------------------------------------------------------------------------

-- +N en un contador (no común) y en todos los enlazados con él. Devuelve cuántas copias.
create function public.log_to_counter(
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

-- ---------------------------------------------------------------------------
-- Fusionar (ahora admite varios contadores de grupo)
-- ---------------------------------------------------------------------------

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

revoke execute on function
  public.my_linked_counters(uuid),
  public.log_to_counter(uuid, numeric, timestamptz, text)
from public, anon;
grant execute on function
  public.my_linked_counters(uuid),
  public.log_to_counter(uuid, numeric, timestamptz, text)
to authenticated;

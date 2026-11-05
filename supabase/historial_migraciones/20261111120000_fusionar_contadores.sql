-- Fusionar contadores (petición del usuario).
--
-- * Solo individuales: los registros pasan a un único contador y los demás se borran.
-- * Un individual (o varios) + uno de grupo: se queda el de grupo y mis registros antiguos se
--   mueven a él marcados como personal_only. Cuentan para mis estadísticas y mi total, pero no
--   para el total del grupo ni la clasificación, y los demás miembros no los ven. Lo que sume
--   después de fusionar cuenta para todo.
-- * Como mucho un contador de grupo por fusión, y nunca contadores comunes.
-- * El nombre y el icono de un contador de grupo son de todos: al fusionar, los que elija el
--   usuario se guardan como alias personal (counter_aliases), solo para él.

-- ---------------------------------------------------------------------------
-- Registros solo personales
-- ---------------------------------------------------------------------------

alter table public.entries add column personal_only boolean not null default false;

-- Los demás miembros no ven mis registros solo personales.
drop policy "entries: veo las mías y las de mi grupo en contadores compartidos" on public.entries;
create policy "entries: veo las mías y las de mi grupo en contadores compartidos"
  on public.entries for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (not personal_only and public.can_view_group_entry(counter_id, user_id))
  );

-- total / entry_count: lo que cuenta para el contador (en uno de grupo, el total del grupo, sin
-- registros solo personales). my_total / my_entry_count: todo lo mío (para mis estadísticas).
-- my_group_total: lo mío que cuenta para el grupo (decide si puedo pulsar −1).
create or replace view public.counter_totals
with (security_invoker = true)
as
select
  e.counter_id,
  coalesce(sum(e.amount) filter (where not e.personal_only), 0) as total,
  (count(*) filter (where e.amount > 0 and not e.personal_only))::int as entry_count,
  max(e.logged_at) as last_logged_at,
  coalesce(sum(e.amount) filter (where e.user_id = (select auth.uid())), 0) as my_total,
  (count(*) filter (where e.amount > 0 and e.user_id = (select auth.uid())))::int as my_entry_count,
  coalesce(
    sum(e.amount) filter (where e.user_id = (select auth.uid()) and not e.personal_only),
    0
  ) as my_group_total
from public.entries e
group by e.counter_id;

-- El −1 resta de la parte que cuenta para el contador, así nunca baja de 0 en el grupo.
create or replace function public.remove_one_from_counter(p_counter_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total numeric;
begin
  select coalesce(sum(e.amount), 0)
    into v_total
    from public.entries e
   where e.counter_id = p_counter_id
     and e.user_id = (select auth.uid())
     and not e.personal_only;

  if v_total < 1 then
    return false;
  end if;

  insert into public.entries (counter_id, amount) values (p_counter_id, -1);
  return true;
end;
$$;

-- La clasificación ignora los registros solo personales.
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
    v_start := date_trunc(period, now() at time zone 'Europe/Madrid');
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
   and (v_start is null or (e.logged_at at time zone 'Europe/Madrid') >= v_start)
  where m.group_id = v_group_id and m.status = 'active'
  group by m.user_id, p.username, p.display_name
  order by 6, 3;
end;
$$;

-- ---------------------------------------------------------------------------
-- Alias personales (nombre e icono que solo veo yo)
-- ---------------------------------------------------------------------------

create table public.counter_aliases (
  counter_id uuid not null references public.counters (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text check (name is null or char_length(btrim(name)) between 1 and 60),
  emoji text check (emoji is null or char_length(emoji) between 1 and 10),
  primary key (counter_id, user_id)
);

alter table public.counter_aliases enable row level security;

create policy "counter_aliases: cada uno los suyos"
  on public.counter_aliases for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.counter_aliases from anon, authenticated;
grant select, insert, update, delete on public.counter_aliases to authenticated;

-- ---------------------------------------------------------------------------
-- Fusionar
-- ---------------------------------------------------------------------------

-- SECURITY INVOKER: todo pasa por la RLS (solo muevo mis registros, solo borro mis contadores
-- privados). Devuelve el id del contador resultante.
create function public.merge_counters(p_counter_ids uuid[], p_name text, p_emoji text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_ids uuid[] := array(select distinct unnest(p_counter_ids));
  v_target uuid;
  v_group_count int;
  v_is_group boolean;
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_emoji text := nullif(btrim(coalesce(p_emoji, '')), '');
begin
  if coalesce(array_length(v_ids, 1), 0) < 2 then
    raise exception 'merge_needs_two';
  end if;

  -- Todos deben existir y ser visibles, y ninguno común.
  if (select count(*) from public.counters c where c.id = any (v_ids) and not c.is_common)
     <> array_length(v_ids, 1) then
    raise exception 'merge_invalid_counters';
  end if;

  select count(*) into v_group_count
    from public.counters c where c.id = any (v_ids) and c.group_id is not null;
  if v_group_count > 1 then
    raise exception 'merge_two_groups';
  end if;

  -- Los individuales tienen que ser míos.
  if exists (
    select 1 from public.counters c
     where c.id = any (v_ids) and c.group_id is null and c.owner_id <> v_user_id
  ) then
    raise exception 'merge_invalid_counters';
  end if;

  v_is_group := v_group_count = 1;
  if v_is_group then
    select c.id into v_target
      from public.counters c where c.id = any (v_ids) and c.group_id is not null;
    if not public.can_log_to_counter(v_target) then
      raise exception 'merge_invalid_counters';
    end if;
  else
    -- Sin grupo, se queda el primero que eligió el usuario.
    v_target := p_counter_ids[1];
  end if;

  -- Mover registros (si el destino es de grupo, como solo personales).
  update public.entries
     set counter_id = v_target,
         personal_only = personal_only or v_is_group
   where counter_id = any (v_ids) and counter_id <> v_target;

  -- El contador resultante entra en las carpetas donde estaba cualquiera de los fusionados.
  insert into public.folder_counters (folder_id, counter_id)
  select distinct fc.folder_id, v_target
    from public.folder_counters fc
   where fc.counter_id = any (v_ids)
  on conflict do nothing;

  delete from public.counters where id = any (v_ids) and id <> v_target;

  if v_is_group then
    if v_name is not null or v_emoji is not null then
      insert into public.counter_aliases (counter_id, name, emoji)
      values (v_target, v_name, v_emoji)
      on conflict (counter_id, user_id) do update set name = excluded.name, emoji = excluded.emoji;
    end if;
  else
    update public.counters
       set name = coalesce(v_name, name),
           emoji = coalesce(v_emoji, emoji)
     where id = v_target;
  end if;

  return v_target;
end;
$$;

revoke execute on function public.merge_counters(uuid[], text, text) from public, anon;
grant execute on function public.merge_counters(uuid[], text, text) to authenticated;

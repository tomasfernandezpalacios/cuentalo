-- Contador común: el total del grupo («entre todos») cuenta cada suma UNA vez (petición del
-- usuario). Un +1 en un común guarda una fila por participante (a cada uno le cuenta en lo suyo),
-- y el total del grupo sumaba todas: +1 con dos participantes daba +2.
--
-- * entries.common_batch: la misma marca en todas las filas de una misma suma (o resta) de un
--   común. Distinto de batch_id (copias de contadores enlazados), que tiene otras reglas.
-- * my_counter_totals y counter_totals: en `total` y `entry_count`, de cada common_batch solo
--   cuenta una fila. El total de cada persona (my_total) no cambia.
-- * Lo ya guardado: las filas de una misma suma se insertaron juntas (mismo created_at), así
--   que se marcan con la misma tanda.

alter table public.entries add column common_batch uuid;
create index entries_common_batch_idx on public.entries (common_batch) where common_batch is not null;

-- Rellenar las sumas ya hechas en contadores comunes.
with batches as (
  select e.counter_id, e.created_at, gen_random_uuid() as batch
    from public.entries e
    join public.counters c on c.id = e.counter_id and c.is_common
   group by e.counter_id, e.created_at
)
update public.entries e
   set common_batch = b.batch
  from batches b
 where e.counter_id = b.counter_id and e.created_at = b.created_at;

create or replace function public.add_to_common_counter(
  p_counter_id uuid,
  p_amount numeric,
  p_logged_at timestamptz default now(),
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_batch uuid := gen_random_uuid();
begin
  if not public.can_log_common(p_counter_id) then
    raise exception 'cannot_log_common';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  insert into public.entries (counter_id, user_id, amount, logged_at, note, common_batch)
  select p_counter_id, p.user_id, p_amount, coalesce(p_logged_at, now()), p_note, v_batch
    from public.counter_participants p
    join public.counters c on c.id = p.counter_id
    join public.group_members m
      on m.group_id = c.group_id and m.user_id = p.user_id and m.status = 'active'
   where p.counter_id = p_counter_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.remove_one_from_common_counter(p_counter_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_batch uuid := gen_random_uuid();
begin
  if not public.can_log_common(p_counter_id) then
    raise exception 'cannot_log_common';
  end if;

  insert into public.entries (counter_id, user_id, amount, common_batch)
  select p_counter_id, p.user_id, -1, v_batch
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

create or replace function public.my_counter_totals()
returns table (
  counter_id uuid,
  total numeric,
  entry_count integer,
  last_logged_at timestamptz,
  my_total numeric,
  my_entry_count integer,
  my_group_total numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  visible as (
    select e.counter_id, e.user_id, e.amount, e.logged_at, e.personal_only, e.group_only,
           e.common_batch
      from public.entries e, me
     where e.user_id = me.id
    union all
    select e.counter_id, e.user_id, e.amount, e.logged_at, e.personal_only, e.group_only,
           e.common_batch
      from me
      join public.group_members mine
        on mine.user_id = me.id and mine.status = 'active'
      join public.counters c on c.group_id = mine.group_id
      join public.entries e on e.counter_id = c.id
      join public.group_members them
        on them.group_id = c.group_id and them.user_id = e.user_id and them.status = 'active'
     where e.user_id <> me.id
       and not e.personal_only
  ),
  -- De cada suma de un común (common_batch), solo cuenta una fila en el total del grupo.
  marked as (
    select v.*,
           v.common_batch is null
             or row_number() over (partition by v.counter_id, v.common_batch order by v.user_id) = 1
             as counts_for_group
      from visible v
  )
  select
    v.counter_id,
    coalesce(sum(v.amount) filter (where not v.personal_only and v.counts_for_group), 0),
    (count(*) filter (where v.amount > 0 and not v.personal_only and v.counts_for_group))::int,
    max(v.logged_at),
    coalesce(sum(v.amount) filter (where v.user_id = me.id and not v.group_only), 0),
    (count(*) filter (where v.amount > 0 and v.user_id = me.id and not v.group_only))::int,
    coalesce(sum(v.amount) filter (where v.user_id = me.id and not v.personal_only), 0)
  from marked v, me
  group by v.counter_id;
$$;

-- La vista (la usa la app si falta get_my_home): mismas reglas, respetando la RLS.
create or replace view public.counter_totals
with (security_invoker = true) as
with marked as (
  select e.*,
         e.common_batch is null
           or row_number() over (partition by e.counter_id, e.common_batch order by e.user_id) = 1
           as counts_for_group
    from public.entries e
)
select
  counter_id,
  coalesce(sum(amount) filter (where not personal_only and counts_for_group), 0::numeric) as total,
  count(*) filter (where amount > 0 and not personal_only and counts_for_group)::integer
    as entry_count,
  max(logged_at) as last_logged_at,
  coalesce(sum(amount) filter (where user_id = (select auth.uid()) and not group_only), 0::numeric)
    as my_total,
  count(*) filter (where amount > 0 and user_id = (select auth.uid()) and not group_only)::integer
    as my_entry_count,
  coalesce(sum(amount) filter (where user_id = (select auth.uid()) and not personal_only), 0::numeric)
    as my_group_total
from marked
group by counter_id;

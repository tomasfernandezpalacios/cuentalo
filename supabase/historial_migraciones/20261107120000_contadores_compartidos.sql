-- Fase 4: contadores compartidos con un grupo y clasificación.
--
-- Un contador compartido es un único contador con group_id; cada miembro inserta sus propias
-- filas en entries. Reglas:
-- * Lo ven los miembros activos del grupo. Cualquiera de ellos puede crearlos en su grupo.
-- * Solo el creador o el owner del grupo lo editan o archivan. No se pueden borrar (borrarían
--   los registros de todos); se archivan.
-- * Cada miembro ve los registros de los miembros activos del grupo en ese contador.
-- * Si alguien sale del grupo conserva sus registros: sigue viendo los suyos y el contador (para
--   sus estadísticas), pero ya no registra ni ve los de los demás, y deja de contar en el grupo.
-- * Si se elimina el grupo, el contador pasa a ser privado de su creador (group_id = null).

alter table public.counters
  add column group_id uuid references public.groups (id) on delete set null;

create index counters_group_idx on public.counters (group_id);

-- ---------------------------------------------------------------------------
-- Funciones auxiliares (SECURITY DEFINER para no recurrir en la RLS)
-- ---------------------------------------------------------------------------

-- ¿Tengo registros en este contador? (para seguir viéndolo tras salir de un grupo)
create function public.has_entries_in_counter(p_counter_id uuid)
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

-- Ahora: privado y mío, o compartido con un grupo donde soy miembro activo.
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
        or (c.group_id is not null and public.is_group_member(c.group_id))
      )
  );
$$;

-- ¿Puedo ver este registro ajeno? Solo si el contador es de un grupo donde ambos somos
-- miembros activos.
create function public.can_view_group_entry(p_counter_id uuid, p_user_id uuid)
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

-- ---------------------------------------------------------------------------
-- Políticas de counters
-- ---------------------------------------------------------------------------

drop policy "counters: el dueño los ve" on public.counters;
drop policy "counters: el dueño los crea" on public.counters;
drop policy "counters: el dueño los edita" on public.counters;
drop policy "counters: el dueño los borra" on public.counters;

create policy "counters: veo los míos, los de mis grupos y en los que tengo registros"
  on public.counters for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or (group_id is not null and public.is_group_member(group_id))
    or public.has_entries_in_counter(id)
  );

create policy "counters: creo privados o en mis grupos"
  on public.counters for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (group_id is null or public.is_group_member(group_id))
  );

-- Privado: su dueño. Compartido: su creador (si sigue en el grupo) o el owner del grupo.
-- group_id y owner_id no se pueden cambiar (ver grants al final).
create policy "counters: editan el dueño o el owner del grupo"
  on public.counters for update
  to authenticated
  using (
    (group_id is null and owner_id = (select auth.uid()))
    or (
      group_id is not null
      and (
        (owner_id = (select auth.uid()) and public.is_group_member(group_id))
        or public.is_group_owner(group_id)
      )
    )
  );

create policy "counters: solo se borran los privados, por su dueño"
  on public.counters for delete
  to authenticated
  using (group_id is null and owner_id = (select auth.uid()));

revoke update on public.counters from authenticated;
grant update (name, unit, emoji, archived, streak_enabled) on public.counters to authenticated;

-- ---------------------------------------------------------------------------
-- Políticas de entries: lectura de los registros del grupo
-- ---------------------------------------------------------------------------

drop policy "entries: veo las mías" on public.entries;

create policy "entries: veo las mías y las de mi grupo en contadores compartidos"
  on public.entries for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.can_view_group_entry(counter_id, user_id)
  );

-- Inserción, edición y borrado siguen limitados a mis registros (políticas de la Fase 1), y
-- can_log_to_counter ya contempla los grupos.

-- ---------------------------------------------------------------------------
-- Totales: añadimos mi parte
-- ---------------------------------------------------------------------------

-- total / entry_count: lo que veo (en un compartido, todo el grupo activo).
-- my_total / my_entry_count: solo lo mío.
create or replace view public.counter_totals
with (security_invoker = true)
as
select
  e.counter_id,
  sum(e.amount) as total,
  (count(*) filter (where e.amount > 0))::int as entry_count,
  max(e.logged_at) as last_logged_at,
  coalesce(sum(e.amount) filter (where e.user_id = (select auth.uid())), 0) as my_total,
  (count(*) filter (where e.amount > 0 and e.user_id = (select auth.uid())))::int as my_entry_count
from public.entries e
group by e.counter_id;

-- ---------------------------------------------------------------------------
-- Clasificación
-- ---------------------------------------------------------------------------

-- Total de cada miembro activo del grupo en el periodo, con su posición (empates comparten
-- posición). Periodos naturales en Europe/Madrid: semana ISO (lunes), mes y año. SECURITY
-- INVOKER: respeta la RLS, así que solo funciona si soy miembro del grupo del contador.
create function public.get_leaderboard(counter_id uuid, period text)
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
   and (v_start is null or (e.logged_at at time zone 'Europe/Madrid') >= v_start)
  where m.group_id = v_group_id and m.status = 'active'
  group by m.user_id, p.username, p.display_name
  order by 6, 3;
end;
$$;

revoke execute on function
  public.has_entries_in_counter(uuid),
  public.can_view_group_entry(uuid, uuid),
  public.get_leaderboard(uuid, text)
from public, anon;
grant execute on function
  public.has_entries_in_counter(uuid),
  public.can_view_group_entry(uuid, uuid),
  public.get_leaderboard(uuid, text)
to authenticated;

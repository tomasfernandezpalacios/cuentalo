-- Rendimiento (petición del usuario): la pantalla principal pedía 9 consultas separadas y dos de
-- ellas (contadores y totales) recorrían TODOS los registros y contadores de la base de datos,
-- comprobando la RLS fila a fila con funciones (has_entries_in_counter, can_view_group_entry…).
-- Con pocos usuarios no se nota; con muchos, cada carga se vuelve más lenta.
--
-- Ahora:
-- 1. my_visible_counter_ids(): los contadores que veo, calculados con índices (las mismas reglas
--    que la política de SELECT de counters).
-- 2. my_counter_totals(): los totales de esos contadores, con joins en vez de una función por
--    fila (las mismas reglas que la política de SELECT de entries).
-- 3. get_my_home(): todo lo que necesita la pantalla principal en UNA sola petición (contadores,
--    totales, grupos, participantes, alias, enlaces, ocultos, quitados y rachas).
-- 4. my_time_zone() se calcula una vez por consulta (antes, una vez por registro).
-- 5. Índices que faltaban para consultas que se hacen a menudo.
--
-- No cambia qué ve cada uno: las reglas son las mismas que las de la RLS.

-- ---------------------------------------------------------------------------
-- 1. Contadores que veo
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 2. Totales
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 3. Todo lo de la pantalla principal en una petición
-- ---------------------------------------------------------------------------

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

revoke execute on function
  public.my_visible_counter_ids(),
  public.my_counter_totals(),
  public.get_my_home()
from public, anon;
grant execute on function
  public.my_visible_counter_ids(),
  public.my_counter_totals(),
  public.get_my_home()
to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Zona horaria: una vez por consulta, no una vez por registro
-- ---------------------------------------------------------------------------

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
alter function public.my_time_zone() reset all;

-- ---------------------------------------------------------------------------
-- 5. Índices
-- ---------------------------------------------------------------------------

-- Alias, solicitudes y amistades se buscan por el usuario (las claves empiezan por el contador
-- o no lo incluyen).
create index if not exists counter_aliases_user_idx on public.counter_aliases (user_id);
create index if not exists counter_requests_requester_idx
  on public.counter_requests (requester_id, status);
create index if not exists friendships_requester_idx on public.friendships (requester_id);
-- Miembros activos de un grupo (totales, clasificaciones, permisos).
create index if not exists group_members_group_status_idx
  on public.group_members (group_id, status, user_id);
-- Registros de un usuario en un contador (permisos, deshacer, «tengo registros aquí»).
create index if not exists entries_user_counter_idx on public.entries (user_id, counter_id);

-- Que el planificador tenga estadísticas al día tras crear los índices.
analyze public.entries;
analyze public.counters;
analyze public.group_members;

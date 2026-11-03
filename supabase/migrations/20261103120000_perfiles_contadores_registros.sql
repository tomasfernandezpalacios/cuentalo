-- Fase 1: perfiles, contadores y registros, con Row Level Security.
-- Se puede pegar entero en el SQL Editor de Supabase o aplicar con `npx supabase db push`.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 50),
  avatar_url text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Datos públicos de cada usuario. Se crea con un trigger al registrarse.';

alter table public.profiles enable row level security;

-- Cualquier usuario con sesión puede ver perfiles (todos los campos son públicos: no hay email).
create policy "profiles: lectura para usuarios autenticados"
  on public.profiles for select
  to authenticated
  using (true);

-- Solo yo edito mi perfil. No hay política de insert ni delete: lo hacen el trigger y el borrado
-- en cascada desde auth.users.
create policy "profiles: cada uno edita el suyo"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Crea el perfil a partir de los metadatos enviados en signUp({ options: { data } }).
create function public.handle_new_user()
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Permite comprobar en el formulario de registro (aún sin sesión) si un username está libre.
create function public.is_username_available(p_username text)
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

revoke execute on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- counters
-- ---------------------------------------------------------------------------

create table public.counters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  unit text not null check (char_length(btrim(unit)) between 1 and 30),
  -- group_id (contadores compartidos) se añade en la Fase 4, cuando exista la tabla groups.
  streak_enabled boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index counters_owner_idx on public.counters (owner_id);

alter table public.counters enable row level security;

-- Fase 1: solo contadores privados, así que todo se limita al dueño.
-- La Fase 4 amplía estas políticas para los contadores de grupo.
create policy "counters: el dueño los ve"
  on public.counters for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "counters: el dueño los crea"
  on public.counters for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "counters: el dueño los edita"
  on public.counters for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "counters: el dueño los borra"
  on public.counters for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- entries
-- ---------------------------------------------------------------------------

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  counter_id uuid not null references public.counters (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  amount numeric not null check (amount > 0 and amount < 1000000000),
  logged_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create index entries_counter_logged_idx on public.entries (counter_id, logged_at);
create index entries_user_logged_idx on public.entries (user_id, logged_at);

alter table public.entries enable row level security;

-- ¿Puede el usuario actual registrar en este contador? SECURITY DEFINER para que la comprobación
-- no dependa de (ni recurra en) las políticas de counters. En la Fase 4 se amplía a
-- "o es miembro activo del grupo del contador".
create function public.can_log_to_counter(p_counter_id uuid)
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
      and c.owner_id = (select auth.uid())
  );
$$;

revoke execute on function public.can_log_to_counter(uuid) from public;
grant execute on function public.can_log_to_counter(uuid) to authenticated;

create policy "entries: veo las mías"
  on public.entries for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "entries: inserto las mías en contadores permitidos"
  on public.entries for insert
  to authenticated
  with check (user_id = (select auth.uid()) and public.can_log_to_counter(counter_id));

create policy "entries: edito las mías"
  on public.entries for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_log_to_counter(counter_id));

create policy "entries: borro las mías"
  on public.entries for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Totales por contador
-- ---------------------------------------------------------------------------

-- security_invoker: la vista se evalúa con los permisos de quien consulta, así que la RLS de
-- entries decide qué filas se suman. Cuando haya contadores compartidos, el total incluirá
-- automáticamente los registros visibles de los demás miembros.
create view public.counter_totals
with (security_invoker = true)
as
select
  e.counter_id,
  sum(e.amount) as total,
  count(*)::int as entry_count,
  max(e.logged_at) as last_logged_at
from public.entries e
group by e.counter_id;

-- ---------------------------------------------------------------------------
-- Permisos de tabla (la RLS filtra después las filas). Explícitos para no depender de los
-- privilegios por defecto del proyecto. Los usuarios sin sesión (anon) no acceden a nada.
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.counters, public.entries, public.counter_totals
  from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, avatar_url) on public.profiles to authenticated;
grant select, insert, update, delete on public.counters, public.entries to authenticated;
grant select on public.counter_totals to authenticated;

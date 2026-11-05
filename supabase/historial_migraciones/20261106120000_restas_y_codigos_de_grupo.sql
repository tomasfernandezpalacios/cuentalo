-- Cambios pedidos tras la Fase 3:
-- 1. El botón −1 deja constancia en el historial: guarda un registro de −1 en vez de modificar
--    el último. El total de cada usuario en un contador nunca baja de 0, y los −1 no cuentan como
--    "registros" en las estadísticas (entry_count solo cuenta cantidades positivas).
-- 2. Unirse a un grupo con un código corto o un enlace.

-- ---------------------------------------------------------------------------
-- 1. Restas como registros
-- ---------------------------------------------------------------------------

alter table public.entries drop constraint entries_amount_check;
alter table public.entries add constraint entries_amount_check
  check (amount <> 0 and abs(amount) < 1000000000);

-- Mismo nombre y firma que antes, así la app no cambia de llamada. Inserta un −1 si mi total en
-- el contador es al menos 1. Devuelve true si ha restado.
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
     and e.user_id = (select auth.uid());

  if v_total < 1 then
    return false;
  end if;

  -- La RLS de entries comprueba que puedo registrar en este contador.
  insert into public.entries (counter_id, amount) values (p_counter_id, -1);
  return true;
end;
$$;

-- Los −1 restan del total pero no suman al número de registros.
create or replace view public.counter_totals
with (security_invoker = true)
as
select
  e.counter_id,
  sum(e.amount) as total,
  (count(*) filter (where e.amount > 0))::int as entry_count,
  max(e.logged_at) as last_logged_at
from public.entries e
group by e.counter_id;

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
group by e.counter_id, e.user_id, (e.logged_at at time zone 'Europe/Madrid')::date;

-- ---------------------------------------------------------------------------
-- 2. Códigos de invitación a grupos
-- ---------------------------------------------------------------------------

-- 8 caracteres de un alfabeto sin los que se confunden (0/O, 1/I/L): 31^8 ≈ 850 000 millones
-- de combinaciones, imposible de adivinar a ciegas. Usa bytes aleatorios criptográficos.
-- SECURITY DEFINER porque se usa como valor por defecto al crear un grupo (lo ejecuta el
-- usuario) y necesita la extensión pgcrypto del esquema extensions.
create function public.generate_invite_code()
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

alter table public.groups
  add column invite_code text not null unique default public.generate_invite_code();

-- El código solo lo ve el owner (mediante la función de abajo): quitamos la columna de la
-- lectura normal de groups, así un invitado o miembro no puede compartirlo por su cuenta.
revoke select on public.groups from authenticated;
grant select (id, name, owner_id, created_at) on public.groups to authenticated;

-- Admite el código con o sin guion, en minúsculas o con espacios.
create function public.normalize_invite_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create function public.get_group_invite_code(p_group_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  select g.invite_code into v_code
    from public.groups g
   where g.id = p_group_id and g.owner_id = (select auth.uid());
  if v_code is null then
    raise exception 'not_group_owner';
  end if;
  return v_code;
end;
$$;

-- El owner puede cambiar el código; el anterior deja de funcionar.
create function public.regenerate_group_invite_code(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_group_owner(p_group_id) then
    raise exception 'not_group_owner';
  end if;
  loop
    v_code := public.generate_invite_code();
    exit when not exists (select 1 from public.groups g where g.invite_code = v_code);
  end loop;
  update public.groups set invite_code = v_code where id = p_group_id;
  return v_code;
end;
$$;

-- Vista previa antes de unirse: nombre del grupo y número de miembros.
create function public.preview_group_by_code(p_code text)
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

-- Unirse con el código. Es una vía distinta a la invitación del owner: quien tiene el código
-- puede entrar aunque no sea amigo del owner (el owner decide con quién lo comparte).
create function public.join_group_by_code(p_code text)
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

revoke execute on function
  public.generate_invite_code(),
  public.get_group_invite_code(uuid),
  public.regenerate_group_invite_code(uuid),
  public.preview_group_by_code(text),
  public.join_group_by_code(text)
from public, anon;
grant execute on function
  public.generate_invite_code(),
  public.get_group_invite_code(uuid),
  public.regenerate_group_invite_code(uuid),
  public.preview_group_by_code(text),
  public.join_group_by_code(text)
to authenticated;

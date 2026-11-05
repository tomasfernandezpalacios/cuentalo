-- Contador común (petición del usuario): un contador de grupo en el que cada +1 o −1 se aplica
-- a todas las personas que eligió su creador (p. ej. "Viajes" para quienes van juntos).
--
-- * counters.is_common marca el contador; counter_participants guarda quién participa.
-- * Al registrar, se inserta una fila en entries por cada participante (con su user_id), así
--   cuenta en las estadísticas personales de cada uno sin introducirlo varias veces.
-- * Cualquier miembro activo del grupo puede pulsar +1 o −1; se aplica a todos los
--   participantes que sigan en el grupo (quien haya salido se salta).
-- * Los participantes se eligen al crear el contador y se pueden cambiar al editarlo (creador
--   u owner del grupo).
-- * Editar o borrar una línea del historial solo afecta a la copia propia.

alter table public.counters add column is_common boolean not null default false;

create table public.counter_participants (
  counter_id uuid not null references public.counters (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (counter_id, user_id)
);

create index counter_participants_user_idx on public.counter_participants (user_id);

alter table public.counter_participants enable row level security;

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

revoke all on public.counter_participants from anon, authenticated;
grant select on public.counter_participants to authenticated;

-- ¿Puede el usuario actual registrar en este contador común? Basta con ser miembro activo.
create function public.can_log_common(p_counter_id uuid)
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
      and c.is_common
      and c.group_id is not null
      and public.is_group_member(c.group_id)
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

-- Define o cambia los participantes (al crear y al editar el contador). Solo quien puede
-- gestionar el contador, y solo con miembros activos del grupo.
create function public.set_counter_participants(p_counter_id uuid, p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_owner_id uuid;
begin
  select c.group_id, c.owner_id into v_group_id, v_owner_id
    from public.counters c
   where c.id = p_counter_id and c.is_common;
  if v_group_id is null then
    raise exception 'not_common_counter';
  end if;
  if not (
    (v_owner_id = (select auth.uid()) and public.is_group_member(v_group_id))
    or public.is_group_owner(v_group_id)
  ) then
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

-- +N para todos los participantes que siguen en el grupo. Devuelve a cuántos se ha sumado.
create function public.add_to_common_counter(
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

-- −1 para todos los participantes que siguen en el grupo y tienen al menos 1.
create function public.remove_one_from_common_counter(p_counter_id uuid)
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

revoke execute on function
  public.can_log_common(uuid),
  public.set_counter_participants(uuid, uuid[]),
  public.add_to_common_counter(uuid, numeric, timestamptz, text),
  public.remove_one_from_common_counter(uuid)
from public, anon;
grant execute on function
  public.can_log_common(uuid),
  public.set_counter_participants(uuid, uuid[]),
  public.add_to_common_counter(uuid, numeric, timestamptz, text),
  public.remove_one_from_common_counter(uuid)
to authenticated;

-- is_common se elige al crear y no se cambia después (no entra en el grant de update).

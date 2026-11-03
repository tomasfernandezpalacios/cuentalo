-- Cambios pedidos tras la Fase 2:
-- 1. La unidad de un contador pasa a ser opcional.
-- 2. Botón -1: resta 1 a mi último registro del contador (o lo borra si era de 1 o menos), así
--    nunca hay cantidades negativas y las sumas de estadísticas y clasificaciones siguen limpias.

-- ---------------------------------------------------------------------------
-- 1. Unidad opcional
-- ---------------------------------------------------------------------------

alter table public.counters alter column unit drop not null;
alter table public.counters drop constraint counters_unit_check;
alter table public.counters add constraint counters_unit_check
  check (unit is null or char_length(btrim(unit)) between 1 and 30);

-- ---------------------------------------------------------------------------
-- 2. Restar uno
-- ---------------------------------------------------------------------------

-- SECURITY INVOKER: se ejecuta con mis permisos, así que la RLS de entries garantiza que solo
-- toco mis propios registros. Devuelve true si había algo que restar.
create function public.remove_one_from_counter(p_counter_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry_id uuid;
  v_amount numeric;
begin
  select e.id, e.amount
    into v_entry_id, v_amount
    from public.entries e
   where e.counter_id = p_counter_id
     and e.user_id = (select auth.uid())
   order by e.logged_at desc, e.created_at desc
   limit 1
   for update;

  if v_entry_id is null then
    return false;
  end if;

  if v_amount > 1 then
    update public.entries set amount = amount - 1 where id = v_entry_id;
  else
    delete from public.entries where id = v_entry_id;
  end if;
  return true;
end;
$$;

revoke execute on function public.remove_one_from_counter(uuid) from public, anon;
grant execute on function public.remove_one_from_counter(uuid) to authenticated;

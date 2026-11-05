-- Gráfica del grupo (petición del usuario): bajo la clasificación, la evolución de un contador
-- de grupo con una línea (o barras) por miembro.
--
-- Devuelve, para cada miembro ACTIVO, lo que sumó cada día (hora de Madrid) en el contador. Es
-- SECURITY INVOKER: la RLS de entries decide qué registros se ven (los de los miembros activos),
-- igual que la clasificación. Sin registros solo personales (de una fusión), que no cuentan
-- para el grupo. La app agrupa los días en semanas, meses o años con chartBuckets.

create function public.get_group_counter_daily(p_counter_id uuid)
returns table (user_id uuid, day date, total numeric)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  select c.group_id into v_group_id from public.counters c where c.id = p_counter_id;
  if v_group_id is null or not public.is_group_member(v_group_id) then
    raise exception 'not_shared_counter';
  end if;

  return query
  select e.user_id,
         (e.logged_at at time zone 'Europe/Madrid')::date,
         sum(e.amount)
    from public.entries e
    join public.group_members m
      on m.group_id = v_group_id and m.user_id = e.user_id and m.status = 'active'
   where e.counter_id = p_counter_id and not e.personal_only
   group by e.user_id, (e.logged_at at time zone 'Europe/Madrid')::date
   order by 2;
end;
$$;

revoke execute on function public.get_group_counter_daily(uuid) from public, anon;
grant execute on function public.get_group_counter_daily(uuid) to authenticated;

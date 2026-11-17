-- Racha de uso: solo cuenta un día si se suma algo en positivo (decisión del usuario,
-- 2026-11-17). Antes cualquier registro, también un −1, mantenía la racha.
create or replace function public.track_activity_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.amount <= 0 then
    return null;
  end if;
  insert into public.user_activity_days (user_id, day)
  values (
    coalesce((select auth.uid()), new.user_id),
    (now() at time zone public.my_time_zone())::date
  )
  on conflict do nothing;
  return null;
end;
$$;

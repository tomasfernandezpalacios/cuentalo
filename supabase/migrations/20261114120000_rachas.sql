-- Rachas (petición del usuario): días seguidos en los que el usuario registra algo.
--
-- * Un día cuenta si ese día (hora de Europe/Madrid) el usuario hace un registro en cualquier
--   contador: +N, −1, cantidad personalizada… Cuenta el día en que pulsa, no la fecha que ponga
--   al registro, para que apuntar algo con fecha pasada no rellene huecos de la racha.
-- * Se guarda aparte (user_activity_days) para que borrar un registro no quite el día.
-- * En un contador común, cuenta para quien pulsa, no para los demás participantes.

create table public.user_activity_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

alter table public.user_activity_days enable row level security;

create policy "user_activity_days: cada uno los suyos"
  on public.user_activity_days for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.user_activity_days from anon, authenticated;
grant select on public.user_activity_days to authenticated;

-- Al insertar un registro, apunta el día para quien lo ha hecho (auth.uid()). Si no hay sesión
-- (p. ej. desde el SQL Editor), usa el dueño del registro.
create function public.track_activity_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_activity_days (user_id, day)
  values (
    coalesce((select auth.uid()), new.user_id),
    (now() at time zone 'Europe/Madrid')::date
  )
  on conflict do nothing;
  return null;
end;
$$;

-- Una vez por sentencia y usuario bastaría, pero por fila es más simple y el insert es idempotente.
create trigger on_entry_track_activity
  after insert on public.entries
  for each row execute function public.track_activity_day();

-- Días que ya había antes de esta migración, según cuándo se crearon los registros.
insert into public.user_activity_days (user_id, day)
select distinct e.user_id, (e.created_at at time zone 'Europe/Madrid')::date
  from public.entries e
on conflict do nothing;

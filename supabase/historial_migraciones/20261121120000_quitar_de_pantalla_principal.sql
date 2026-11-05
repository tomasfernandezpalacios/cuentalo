-- Quitar un contador de grupo de mi pantalla principal (petición del usuario).
--
-- Quien no es el administrador de un contador de grupo no puede borrarlo, pero sí quitarlo de
-- su pantalla principal. Sigue perteneciendo a él (cuenta en la clasificación, puede sumar y lo
-- ve dentro del grupo); solo deja de salir en su lista. Se deshace desde el propio contador con
-- «Añadir a la pantalla principal». Es personal: solo lo ve y lo toca su dueño.
--
-- (Distinto de hidden_counters: los ocultos siguen saliendo al final de la lista.)

create table public.home_removed_counters (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  counter_id uuid not null references public.counters (id) on delete cascade,
  primary key (user_id, counter_id)
);

alter table public.home_removed_counters enable row level security;

create policy "home_removed_counters: cada uno los suyos"
  on public.home_removed_counters for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.home_removed_counters from anon, authenticated;
grant select, insert, delete on public.home_removed_counters to authenticated;

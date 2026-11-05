-- Fecha de nacimiento del usuario (petición del usuario: que sea información de su cuenta y no
-- solo del móvil). La usa el «Resumen vital» de Estadísticas.
--
-- No va en profiles porque los perfiles los puede leer cualquiera con sesión (nombre, foto…).
-- Va en una tabla privada: cada uno solo ve y cambia la suya. Se borra con la cuenta.

create table public.profile_private (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  birth_date date check (birth_date is null or (birth_date <= current_date and birth_date >= date '1900-01-01')),
  updated_at timestamptz not null default now()
);

alter table public.profile_private enable row level security;

create policy "profile_private: cada uno la suya"
  on public.profile_private for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.profile_private from anon, authenticated;
grant select, insert, update on public.profile_private to authenticated;

-- Entrar con el nombre de usuario además del email (petición del usuario).
--
-- La app necesita el email para iniciar sesión (Supabase Auth entra con email y contraseña).
-- Devolver el email de cualquier nombre de usuario dejaría ver los emails de todos, así que
-- login_email_for_username solo lo devuelve si la contraseña es la buena (la comprueba contra
-- auth.users con crypt, igual que Auth). Para que no sirva para probar contraseñas sin límite,
-- se apuntan los fallos: con 10 en 15 minutos para un mismo usuario, se bloquea un rato.

create table public.login_attempts (
  username text not null,
  attempted_at timestamptz not null default now()
);
create index login_attempts_username_idx on public.login_attempts (username, attempted_at);

-- Nadie la lee ni la escribe directamente (solo la función de abajo).
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

create or replace function public.login_email_for_username(p_username text, p_password text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(trim(coalesce(p_username, '')));
  v_email text;
  v_hash text;
begin
  if (
    select count(*) from public.login_attempts
     where username = v_username and attempted_at > now() - interval '15 minutes'
  ) >= 10 then
    raise exception 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
  end if;

  select u.email, u.encrypted_password into v_email, v_hash
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.username = v_username;

  if v_hash is not null and extensions.crypt(coalesce(p_password, ''), v_hash) = v_hash then
    delete from public.login_attempts where username = v_username;
    return v_email;
  end if;

  insert into public.login_attempts (username) values (v_username);
  -- Limpieza de paso: los fallos de hace más de un día ya no sirven.
  delete from public.login_attempts where attempted_at < now() - interval '1 day';
  return null;
end;
$$;

revoke all on function public.login_email_for_username(text, text) from public, anon, authenticated;
grant execute on function public.login_email_for_username(text, text) to anon, authenticated;

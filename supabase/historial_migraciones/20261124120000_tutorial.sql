-- Tutorial de bienvenida (petición del usuario): se enseña la primera vez que alguien inicia
-- sesión. Se guarda en el perfil (y no solo en el móvil) para que no se repita al cambiar de
-- teléfono o reinstalar la app. Se marca al terminarlo o saltarlo; desde Configuración se
-- puede volver a ver cuando se quiera.

alter table public.profiles add column tutorial_done boolean not null default false;

grant update (tutorial_done) on public.profiles to authenticated;

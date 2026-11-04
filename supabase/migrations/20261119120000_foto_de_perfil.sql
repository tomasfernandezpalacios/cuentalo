-- Foto de perfil (petición del usuario): cada persona puede ponerse un emoticono o una foto.
--
-- Igual que el resto del perfil, la imagen la ve cualquier usuario con sesión (sale al buscar
-- amigos, en los grupos y en las clasificaciones). Las fotos van a un bucket PRIVADO
-- ('profile-photos', ruta '<user_id>/<archivo>'): sin sesión no se pueden ver, la app pide
-- enlaces firmados temporales, y cada uno solo sube, cambia o borra las de su propia carpeta.

alter table public.profiles
  add column emoji text check (emoji is null or char_length(emoji) between 1 and 10),
  add column photo_path text check (photo_path is null or char_length(photo_path) <= 200);

grant update (emoji, photo_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "profile-photos: las ven los usuarios con sesión"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'profile-photos');

create policy "profile-photos: cada uno sube las suyas"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );

create policy "profile-photos: cada uno cambia las suyas"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );

create policy "profile-photos: cada uno borra las suyas"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );

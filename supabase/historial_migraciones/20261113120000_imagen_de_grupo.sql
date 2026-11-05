-- Imagen de los grupos (petición del usuario): un emoticono o una foto.
--
-- Las fotos van a un bucket PRIVADO de Supabase Storage ('group-photos'), en la ruta
-- '<group_id>/<archivo>'. Solo los miembros e invitados del grupo pueden leerlas (la app pide
-- enlaces temporales firmados) y solo el owner puede subirlas, cambiarlas o borrarlas.

alter table public.groups
  add column emoji text check (emoji is null or char_length(emoji) between 1 and 10),
  add column photo_path text check (photo_path is null or char_length(photo_path) <= 200);

grant select (emoji, photo_path) on public.groups to authenticated;
grant update (emoji, photo_path) on public.groups to authenticated;

-- ---------------------------------------------------------------------------
-- Almacenamiento
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-photos', 'group-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Id del grupo a partir de la ruta '<group_id>/...'; null si la ruta no tiene esa forma (así
-- las políticas nunca fallan al convertir a uuid).
create function public.group_id_from_path(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

create policy "group-photos: las ven los del grupo"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'group-photos'
    and public.is_group_participant(public.group_id_from_path(name))
  );

create policy "group-photos: las sube el owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'group-photos'
    and public.is_group_owner(public.group_id_from_path(name))
  );

create policy "group-photos: las cambia el owner"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'group-photos'
    and public.is_group_owner(public.group_id_from_path(name))
  );

create policy "group-photos: las borra el owner"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'group-photos'
    and public.is_group_owner(public.group_id_from_path(name))
  );

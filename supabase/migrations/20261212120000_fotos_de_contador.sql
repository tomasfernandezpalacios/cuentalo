-- Foto como icono de un contador (petición del usuario), además del emoticono.
--
-- * counters.photo_path: ruta en el bucket privado 'counter-photos' ('<counter_id>/<ts>.jpg').
-- * La sube/cambia/borra quien puede editar el contador: su dueño si es individual o su
--   administrador si es de grupo (mismas reglas que para editarlo).
-- * La ve quien ve el contador (my_visible_counter_ids) y, en los individuales visibles para
--   amigos, sus amigos (perfil de otros).

alter table public.counters add column photo_path text;
grant update (photo_path) on public.counters to authenticated;

-- ¿Puedo cambiar la foto de este contador?
create or replace function public.can_edit_counter_photo(p_counter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.counters c
     where c.id = p_counter_id
       and c.owner_id = (select auth.uid())
       and (c.group_id is null or public.is_group_member(c.group_id))
  );
$$;

-- ¿Puedo ver la foto de este contador?
create or replace function public.can_see_counter_photo(p_counter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_counter_id in (select public.my_visible_counter_ids())
    or exists (
      select 1 from public.counters c
       where c.id = p_counter_id
         and c.group_id is null
         and not c.hidden_from_friends
         and public.are_friends(c.owner_id, (select auth.uid()))
    );
$$;

revoke all on function public.can_edit_counter_photo(uuid) from public, anon, authenticated;
revoke all on function public.can_see_counter_photo(uuid) from public, anon, authenticated;
grant execute on function public.can_edit_counter_photo(uuid) to authenticated;
grant execute on function public.can_see_counter_photo(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('counter-photos', 'counter-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- group_id_from_path solo saca el uuid del principio de la ruta: sirve igual para contadores.
create policy "counter-photos: las ve quien ve el contador"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'counter-photos'
    and public.can_see_counter_photo(public.group_id_from_path(name))
  );

create policy "counter-photos: las sube quien edita el contador"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'counter-photos'
    and public.can_edit_counter_photo(public.group_id_from_path(name))
  );

create policy "counter-photos: las cambia quien edita el contador"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'counter-photos'
    and public.can_edit_counter_photo(public.group_id_from_path(name))
  );

create policy "counter-photos: las borra quien edita el contador"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'counter-photos'
    and public.can_edit_counter_photo(public.group_id_from_path(name))
  );

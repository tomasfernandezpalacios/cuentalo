-- Contactos y sugerencias de amistad (petición del usuario).
--
-- * phone_directory: quien sincroniza su número aparece en los contactos de los demás (es
--   voluntario: sin fila, nadie te encuentra por el teléfono). No se guarda el número, solo un
--   resumen SHA-256 calculado en el móvil (de 'cuentalo:' + sus 9 últimas cifras). El número no
--   se verifica por SMS (costaría dinero).
-- * get_friend_suggestions: personas que quizá conozcas: tus contactos que están en la app y
--   amigos de tus amigos (con cuántos amigos tenéis en común), sin las que ya tienen relación
--   contigo (amigos, solicitudes enviadas, recibidas o rechazadas).

create table public.phone_directory (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  phone_hash text not null check (phone_hash ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now()
);

create index phone_directory_phone_hash_idx on public.phone_directory (phone_hash);

alter table public.phone_directory enable row level security;

-- Cada uno ve y borra solo su fila; se escribe con set_my_phone.
create policy "phone_directory: ver la mía" on public.phone_directory
  for select to authenticated using (user_id = (select auth.uid()));
create policy "phone_directory: borrar la mía" on public.phone_directory
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.phone_directory from anon, authenticated;
grant select, delete on public.phone_directory to authenticated;

-- Guarda (o cambia) el resumen de mi número.
create or replace function public.set_my_phone(p_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Tienes que iniciar sesión';
  end if;
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Número de teléfono no válido';
  end if;
  insert into public.phone_directory (user_id, phone_hash)
  values (auth.uid(), p_hash)
  on conflict (user_id) do update set phone_hash = excluded.phone_hash, updated_at = now();
end;
$$;

-- Sugerencias: primero mis contactos que están en la app, después amigos de amigos (más amigos
-- en común primero). p_contact_hashes: los resúmenes de los números de mi agenda (como mucho
-- 3000; solo se comparan con quien haya sincronizado su número).
create or replace function public.get_friend_suggestions(
  p_contact_hashes text[] default '{}',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  display_name text,
  emoji text,
  photo_path text,
  is_contact boolean,
  mutual_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select auth.uid() as uid
  ),
  related as (
    -- Cualquiera con quien ya tengo una amistad o una solicitud (en cualquier estado).
    select case when f.requester_id = me.uid then f.addressee_id else f.requester_id end as uid
    from public.friendships f, me
    where me.uid in (f.requester_id, f.addressee_id)
  ),
  my_friends as (
    select case when f.requester_id = me.uid then f.addressee_id else f.requester_id end as uid
    from public.friendships f, me
    where f.status = 'accepted' and me.uid in (f.requester_id, f.addressee_id)
  ),
  contacts as (
    select distinct d.user_id as uid
    from public.phone_directory d
    where d.phone_hash = any (coalesce(p_contact_hashes[1:3000], '{}'))
  ),
  friends_of_friends as (
    select
      case when f.requester_id = mf.uid then f.addressee_id else f.requester_id end as uid,
      count(*)::integer as mutual
    from my_friends mf
    join public.friendships f
      on f.status = 'accepted' and mf.uid in (f.requester_id, f.addressee_id)
    group by 1
  ),
  candidates as (
    select uid from contacts
    union
    select uid from friends_of_friends
  )
  select
    p.id,
    p.username,
    p.display_name,
    p.emoji,
    p.photo_path,
    (c.uid is not null) as is_contact,
    coalesce(fof.mutual, 0) as mutual_count
  from candidates cand
  join public.profiles p on p.id = cand.uid
  left join contacts c on c.uid = cand.uid
  left join friends_of_friends fof on fof.uid = cand.uid
  where cand.uid <> (select uid from me)
    and cand.uid not in (select uid from related)
  order by (c.uid is not null) desc, coalesce(fof.mutual, 0) desc, p.display_name
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.set_my_phone(text) from public, anon, authenticated;
revoke all on function public.get_friend_suggestions(text[], integer, integer)
  from public, anon, authenticated;
grant execute on function public.set_my_phone(text) to authenticated;
grant execute on function public.get_friend_suggestions(text[], integer, integer) to authenticated;

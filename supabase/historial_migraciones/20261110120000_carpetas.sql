-- Carpetas para organizar la lista de contadores (petición del usuario).
-- Son personales: cada usuario ve y gestiona solo las suyas. Un contador puede estar en varias
-- carpetas, incluidos los compartidos que veo.

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  created_at timestamptz not null default now()
);

create index folders_owner_idx on public.folders (owner_id);

create table public.folder_counters (
  folder_id uuid not null references public.folders (id) on delete cascade,
  counter_id uuid not null references public.counters (id) on delete cascade,
  primary key (folder_id, counter_id)
);

create index folder_counters_counter_idx on public.folder_counters (counter_id);

alter table public.folders enable row level security;
alter table public.folder_counters enable row level security;

create policy "folders: cada uno las suyas"
  on public.folders for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Solo en mis carpetas, y solo con contadores que puedo ver (la subconsulta respeta la RLS de
-- counters).
create policy "folder_counters: en mis carpetas"
  on public.folder_counters for all
  to authenticated
  using (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = (select auth.uid()))
    and exists (select 1 from public.counters c where c.id = counter_id)
  );

revoke all on public.folders, public.folder_counters from anon, authenticated;
grant select, insert, delete on public.folders to authenticated;
grant update (name) on public.folders to authenticated;
grant select, insert, delete on public.folder_counters to authenticated;

-- Crea (p_folder_id null) o actualiza una carpeta con su lista de contadores, todo de una vez.
-- SECURITY INVOKER: la RLS de arriba decide qué se puede tocar. Devuelve el id de la carpeta.
create function public.save_folder(p_folder_id uuid, p_name text, p_counter_ids uuid[])
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_folder_id uuid := p_folder_id;
begin
  if v_folder_id is null then
    insert into public.folders (name) values (btrim(p_name)) returning id into v_folder_id;
  else
    update public.folders set name = btrim(p_name) where id = v_folder_id;
    if not found then
      raise exception 'folder_not_found';
    end if;
    delete from public.folder_counters where folder_id = v_folder_id;
  end if;

  insert into public.folder_counters (folder_id, counter_id)
  select v_folder_id, unnest(coalesce(p_counter_ids, '{}'::uuid[]))
  on conflict do nothing;

  return v_folder_id;
end;
$$;

revoke execute on function public.save_folder(uuid, text, uuid[]) from public, anon;
grant execute on function public.save_folder(uuid, text, uuid[]) to authenticated;

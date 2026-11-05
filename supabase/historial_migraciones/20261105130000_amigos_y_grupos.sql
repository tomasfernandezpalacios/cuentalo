-- Fase 3: amistades, grupos y miembros, con Row Level Security.
-- Las funciones auxiliares son SECURITY DEFINER para que las políticas puedan consultar
-- group_members sin volver a disparar su propia RLS (lo que daría recursión infinita).

-- ---------------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------------

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint friendships_no_self check (requester_id <> addressee_id)
);

-- Una sola fila por pareja, sin importar quién la pidió (A→B bloquea B→A).
create unique index friendships_pair_idx on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);
create index friendships_addressee_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;

create policy "friendships: veo las que me implican"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy "friendships: envío solicitudes en mi nombre"
  on public.friendships for insert
  to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');

-- Solo el destinatario responde. Solo puede tocar la columna status (ver grants al final).
create policy "friendships: el destinatario acepta o rechaza"
  on public.friendships for update
  to authenticated
  using (addressee_id = (select auth.uid()) and status = 'pending')
  with check (addressee_id = (select auth.uid()) and status in ('accepted', 'rejected'));

-- Cualquiera de los dos puede borrarla: cancelar una solicitud o dejar de ser amigos.
create policy "friendships: cualquiera de los dos la borra"
  on public.friendships for delete
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create function public.are_friends(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(p_user_a, p_user_b)
      and greatest(f.requester_id, f.addressee_id) = greatest(p_user_a, p_user_b)
  );
$$;

-- ---------------------------------------------------------------------------
-- groups y group_members
-- ---------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 50),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'invited' check (status in ('invited', 'active')),
  joined_at timestamptz,
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Soy miembro activo del grupo.
create function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;

-- Estoy en el grupo, como miembro activo o con una invitación pendiente.
create function public.is_group_participant(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = (select auth.uid())
  );
$$;

create function public.is_group_owner(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.groups g
    where g.id = p_group_id and g.owner_id = (select auth.uid())
  );
$$;

-- groups ----------------------------------------------------------------------

create policy "groups: lo ven sus miembros e invitados"
  on public.groups for select
  to authenticated
  using (public.is_group_participant(id) or owner_id = (select auth.uid()));

create policy "groups: cualquiera crea grupos propios"
  on public.groups for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "groups: el owner lo renombra"
  on public.groups for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "groups: el owner lo borra"
  on public.groups for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Al crear un grupo, su creador entra como owner activo.
create function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id, role, status, joined_at)
  values (new.id, new.owner_id, 'owner', 'active', now());
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- group_members ----------------------------------------------------------------

-- Los miembros activos ven a todos; un invitado solo ve su propia fila (su invitación).
create policy "group_members: lectura para miembros y la propia invitación"
  on public.group_members for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_group_member(group_id));

-- Solo el owner invita, y solo a amigos aceptados.
create policy "group_members: el owner invita a sus amigos"
  on public.group_members for insert
  to authenticated
  with check (
    public.is_group_owner(group_id)
    and role = 'member'
    and status = 'invited'
    and public.are_friends((select auth.uid()), user_id)
  );

-- El invitado acepta su invitación (invited → active). Solo puede tocar status.
create policy "group_members: el invitado acepta"
  on public.group_members for update
  to authenticated
  using (user_id = (select auth.uid()) and status = 'invited')
  with check (user_id = (select auth.uid()) and status = 'active');

-- El owner expulsa a otros (o retira invitaciones); cada miembro puede salir o rechazar su
-- invitación. El owner no puede salir: debe borrar el grupo.
create policy "group_members: el owner expulsa y cada uno sale"
  on public.group_members for delete
  to authenticated
  using (
    (public.is_group_owner(group_id) and role <> 'owner')
    or (user_id = (select auth.uid()) and role <> 'owner')
  );

-- Al aceptar la invitación se apunta la fecha de entrada.
create function public.set_joined_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' and old.status = 'invited' then
    new.joined_at := now();
  end if;
  return new;
end;
$$;

create trigger on_group_member_accepted
  before update on public.group_members
  for each row execute function public.set_joined_at();

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

revoke all on public.friendships, public.groups, public.group_members from anon, authenticated;

grant select, insert, delete on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;

grant select, insert, delete on public.groups to authenticated;
grant update (name) on public.groups to authenticated;

grant select, insert, delete on public.group_members to authenticated;
grant update (status) on public.group_members to authenticated;

revoke execute on function
  public.are_friends(uuid, uuid),
  public.is_group_member(uuid),
  public.is_group_participant(uuid),
  public.is_group_owner(uuid)
from public, anon;
grant execute on function
  public.are_friends(uuid, uuid),
  public.is_group_member(uuid),
  public.is_group_participant(uuid),
  public.is_group_owner(uuid)
to authenticated;

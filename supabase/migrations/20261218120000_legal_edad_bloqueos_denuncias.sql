-- Preparación legal para publicar (docs/legal/2026-11-17-analisis-legal.md):
--   1. Registro: edad mínima (14 años, art. 7 LOPDGDD) y aceptación de las condiciones.
--   2. Bloquear usuarios (guía 1.2 de Apple y DSA).
--   3. Denunciar usuarios y grupos (guía 1.2 de Apple y art. 16 DSA).
--   4. Resúmenes de la agenda: se borran solos cada día (no se guardan datos de terceros).

-- 1. Edad mínima y aceptación ------------------------------------------------------------------

-- Una sola cifra para toda la base de datos. Si la ley sube a 16, se cambia aquí y en la app
-- (src/features/legal/legal.ts).
create or replace function public.minimum_age()
returns integer
language sql
immutable
set search_path = ''
as $$ select 14 $$;

alter table public.profile_private
  add column terms_accepted_at timestamptz,
  add column terms_version text check (terms_version is null or char_length(terms_version) <= 20);

-- La app ya comprueba la edad y la aceptación antes de registrar; esto es la última barrera
-- (nadie puede crear una cuenta llamando a la API directamente sin ellas).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_birth date;
  v_terms text := nullif(btrim(new.raw_user_meta_data ->> 'terms_version'), '');
begin
  begin
    v_birth := (new.raw_user_meta_data ->> 'birth_date')::date;
  exception when others then
    v_birth := null;
  end;

  if v_birth is null
     or v_birth < date '1900-01-01'
     or v_birth > (current_date - make_interval(years => public.minimum_age()))::date then
    raise exception 'Tienes que tener al menos % años para usar Cuéntalo.', public.minimum_age();
  end if;
  if v_terms is null then
    raise exception 'Tienes que aceptar las condiciones de uso y la política de privacidad.';
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      new.raw_user_meta_data ->> 'username'
    )
  );

  insert into public.profile_private (user_id, birth_date, terms_accepted_at, terms_version)
  values (new.id, v_birth, now(), left(v_terms, 20));

  return new;
end;
$$;

-- 2. Bloqueos ----------------------------------------------------------------------------------

create table public.user_blocks (
  blocker_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_id_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;
-- Cada uno ve y deshace solo sus bloqueos. Nadie sabe quién le ha bloqueado.
grant select, delete on public.user_blocks to authenticated;

create policy "user_blocks: veo los míos"
  on public.user_blocks for select
  to authenticated
  using (blocker_id = (select auth.uid()));

create policy "user_blocks: desbloqueo los míos"
  on public.user_blocks for delete
  to authenticated
  using (blocker_id = (select auth.uid()));

-- ¿Alguno de los dos ha bloqueado al otro?
create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks b
     where (b.blocker_id = p_a and b.blocked_id = p_b)
        or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;
revoke all on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;

-- Bloquear: deja de ser amigo (y se borra cualquier solicitud) y se retiran las invitaciones a
-- grupos entre los dos. Los grupos que ya compartís siguen igual (cada uno puede salir).
create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if p_user_id is null or p_user_id = v_me
     or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'No se puede bloquear a esta persona.';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_me, p_user_id)
  on conflict do nothing;

  delete from public.friendships f
   where (f.requester_id = v_me and f.addressee_id = p_user_id)
      or (f.requester_id = p_user_id and f.addressee_id = v_me);

  delete from public.group_members gm
   using public.groups g
   where gm.group_id = g.id
     and gm.status = 'invited'
     and ((gm.user_id = p_user_id and g.owner_id = v_me)
       or (gm.user_id = v_me and g.owner_id = p_user_id));
end;
$$;
revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- Con un bloqueo de por medio no se pueden enviar solicitudes de amistad ni invitar a grupos.
create or replace function public.check_not_blocked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'friendships' then
    if public.is_blocked_between(new.requester_id, new.addressee_id) then
      raise exception 'No puedes enviar una solicitud de amistad a esta persona.';
    end if;
  elsif new.status = 'invited' and (select auth.uid()) is not null
        and public.is_blocked_between((select auth.uid()), new.user_id) then
    raise exception 'No puedes invitar a esta persona.';
  end if;
  return new;
end;
$$;
revoke all on function public.check_not_blocked() from public, anon, authenticated;

create trigger friendships_not_blocked
  before insert on public.friendships
  for each row execute function public.check_not_blocked();

create trigger group_invites_not_blocked
  before insert on public.group_members
  for each row execute function public.check_not_blocked();

-- Sugerencias: nunca alguien bloqueado (en cualquiera de los dos sentidos).
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
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_me uuid := (select auth.uid());
  v_hashes text[];
  v_used int;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  v_hashes := array(
    select distinct h from unnest(coalesce(p_contact_hashes[1:3000], '{}')) h
     where h ~ '^[0-9a-f]{64}$'
  );

  -- Cupo: como mucho 3000 resúmenes distintos al día por usuario. Volver a mandar la misma
  -- agenda no gasta nada. Los resúmenes solo sirven para este cupo y se borran cada noche
  -- (tarea «borrar-resumenes-de-agenda», abajo), así no queda guardado a quién conoce nadie.
  delete from public.contact_lookups where user_id = v_me and day < current_date;
  select count(*) into v_used from public.contact_lookups where user_id = v_me;
  insert into public.contact_lookups (user_id, day, phone_hash)
  select v_me, current_date, h
    from unnest(v_hashes) h
   where not exists (
     select 1 from public.contact_lookups l where l.user_id = v_me and l.phone_hash = h
   )
   limit greatest(3000 - v_used, 0)
  on conflict do nothing;

  return query
  with me as (
    select v_me as uid
  ),
  related as (
    -- Cualquiera con quien ya tengo una amistad o una solicitud (en cualquier estado).
    select case when f.requester_id = me.uid then f.addressee_id else f.requester_id end as uid
    from public.friendships f, me
    where me.uid in (f.requester_id, f.addressee_id)
    union
    -- Y cualquiera con un bloqueo de por medio.
    select case when b.blocker_id = me.uid then b.blocked_id else b.blocker_id end as uid
    from public.user_blocks b, me
    where me.uid in (b.blocker_id, b.blocked_id)
  ),
  my_friends as (
    select case when f.requester_id = me.uid then f.addressee_id else f.requester_id end as uid
    from public.friendships f, me
    where f.status = 'accepted' and me.uid in (f.requester_id, f.addressee_id)
  ),
  contacts as (
    -- Solo los resúmenes que caben en mi cupo de hoy (ver arriba).
    select distinct d.user_id as uid
    from public.phone_directory d
    join public.contact_lookups l
      on l.user_id = v_me and l.phone_hash = d.phone_hash
    where d.phone_hash = any (v_hashes)
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
end;
$$;

-- 3. Denuncias ---------------------------------------------------------------------------------

-- Las revisa el responsable de la app en el panel de Supabase (Table Editor → reports). La app
-- no puede leerlas: solo enviarlas con report_content. Se guarda una copia de lo denunciado
-- (nombre, @usuario, foto) por si lo cambian después.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references public.profiles(id) on delete set null,
  target_kind text not null check (target_kind in ('user', 'group')),
  target_user_id uuid references public.profiles(id) on delete set null,
  target_group_id uuid references public.groups(id) on delete set null,
  target_snapshot jsonb not null default '{}'::jsonb,
  reason text not null check (
    reason in ('offensive', 'harassment', 'impersonation', 'spam', 'sexual_violent', 'other')
  ),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index reports_status_idx on public.reports (status, created_at);
create index reports_reporter_id_idx on public.reports (reporter_id);
create index reports_target_user_id_idx on public.reports (target_user_id);
create index reports_target_group_id_idx on public.reports (target_group_id);

alter table public.reports enable row level security;
revoke all on public.reports from public, anon, authenticated;

create or replace function public.report_content(
  p_kind text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_snapshot jsonb;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if (select count(*) from public.reports
       where reporter_id = v_me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Has enviado muchas denuncias hoy. Inténtalo mañana.';
  end if;

  if p_kind = 'user' then
    select jsonb_build_object(
             'username', p.username, 'display_name', p.display_name,
             'emoji', p.emoji, 'photo_path', p.photo_path)
      into v_snapshot
      from public.profiles p
     where p.id = p_target_id and p.id <> v_me;
  elsif p_kind = 'group' then
    -- Solo se denuncia un grupo que se puede ver (miembro o invitado).
    select jsonb_build_object(
             'name', g.name, 'emoji', g.emoji, 'photo_path', g.photo_path, 'owner_id', g.owner_id)
      into v_snapshot
      from public.groups g
     where g.id = p_target_id and public.is_group_participant(g.id);
  end if;
  if v_snapshot is null then
    raise exception 'No se puede denunciar esto.';
  end if;

  insert into public.reports (
    reporter_id, target_kind, target_user_id, target_group_id, target_snapshot, reason, details
  )
  values (
    v_me,
    p_kind,
    case when p_kind = 'user' then p_target_id end,
    case when p_kind = 'group' then p_target_id end,
    v_snapshot,
    p_reason,
    nullif(left(btrim(coalesce(p_details, '')), 1000), '')
  );
end;
$$;
revoke all on function public.report_content(text, uuid, text, text) from public, anon;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;

-- 4. Limpieza diaria (pg_cron) ------------------------------------------------------------------

create extension if not exists pg_cron;

-- Cada noche: los resúmenes de agendas de días anteriores (solo valían para el cupo) y los
-- intentos de inicio de sesión de hace más de un día (solo valen para el bloqueo de 15 min).
select cron.schedule(
  'borrar-resumenes-de-agenda',
  '15 3 * * *',
  $$
    delete from public.contact_lookups where day < current_date;
    delete from public.login_attempts where attempted_at < now() - interval '1 day';
  $$
);

-- Y una vez ahora, para lo que ya había.
delete from public.contact_lookups where day < current_date;
delete from public.login_attempts where attempted_at < now() - interval '1 day';

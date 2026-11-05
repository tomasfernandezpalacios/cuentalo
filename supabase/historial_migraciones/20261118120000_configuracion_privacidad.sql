-- Configuración (petición del usuario): opciones de privacidad guardadas en el perfil.
--
-- * hide_streak: mis amigos no ven mi racha (ni en su clasificación ni en mi perfil).
-- * hide_counters_from_friends: mis amigos no ven ninguno de mis contadores en mi perfil; los
--   contadores en común (de grupos de los dos) se siguen viendo, porque ya los ven en el grupo.
-- * group_invites: 'friends' (mis amigos pueden invitarme a sus grupos, como hasta ahora) o
--   'nobody' (solo entro a grupos con un código o enlace).
--
-- Son columnas de profiles, legibles por cualquier usuario autenticado (como el resto del
-- perfil): así la app puede explicar por qué no ve una racha o no puede invitar a alguien.

alter table public.profiles
  add column hide_streak boolean not null default false,
  add column hide_counters_from_friends boolean not null default false,
  add column group_invites text not null default 'friends'
    check (group_invites in ('friends', 'nobody'));

grant update (hide_streak, hide_counters_from_friends, group_invites)
  on public.profiles to authenticated;

-- Invitar a un grupo: además de ser amigos, el invitado tiene que aceptar invitaciones.
drop policy "group_members: el owner invita a sus amigos" on public.group_members;
create policy "group_members: el owner invita a sus amigos"
  on public.group_members for insert
  to authenticated
  with check (
    public.is_group_owner(group_id)
    and role = 'member'
    and status = 'invited'
    and public.are_friends((select auth.uid()), user_id)
    and exists (
      select 1 from public.profiles p
       where p.id = user_id and p.group_invites = 'friends'
    )
  );

create or replace function public.get_friends_streaks()
returns table (
  user_id uuid,
  username text,
  display_name text,
  current_streak int,
  best_streak int
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as id
  ),
  people as (
    select id from me where id is not null
    union
    select case when f.requester_id = me.id then f.addressee_id else f.requester_id end
      from public.friendships f, me
     where f.status = 'accepted' and me.id in (f.requester_id, f.addressee_id)
       -- Quien oculta su racha no sale en la de sus amigos (pero sí se ve a sí mismo).
       and not (
         select pr.hide_streak from public.profiles pr
          where pr.id = case when f.requester_id = me.id then f.addressee_id else f.requester_id end
       )
  ),
  islands as (
    select a.user_id, a.day,
           a.day - (row_number() over (partition by a.user_id order by a.day))::int as grp
      from public.user_activity_days a
     where a.user_id in (select id from people)
  ),
  runs as (
    select i.user_id, max(i.day) as end_day, count(*)::int as len
      from islands i
     group by i.user_id, i.grp
  ),
  today as (
    select (now() at time zone 'Europe/Madrid')::date as d
  )
  select
    p.id,
    pr.username,
    pr.display_name,
    coalesce((
      select r.len from runs r, today
       where r.user_id = p.id and r.end_day >= today.d - 1
       order by r.end_day desc
       limit 1
    ), 0) as current_streak,
    coalesce((select max(r.len) from runs r where r.user_id = p.id), 0) as best_streak
  from people p
  join public.profiles pr on pr.id = p.id;
$$;

create or replace function public.get_user_counters(p_user_id uuid)
returns table (
  counter_id uuid,
  name text,
  emoji text,
  unit text,
  group_name text,
  kind text,
  their_total numeric,
  my_total numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as id
  ),
  friends as (
    select exists (
      select 1 from public.friendships f, me
       where f.status = 'accepted'
         and least(f.requester_id, f.addressee_id) = least(me.id, p_user_id)
         and greatest(f.requester_id, f.addressee_id) = greatest(me.id, p_user_id)
    ) as yes
  ),
  their_groups as (
    select m.group_id from public.group_members m
     where m.user_id = p_user_id and m.status = 'active'
  ),
  my_groups as (
    select m.group_id from public.group_members m, me
     where m.user_id = me.id and m.status = 'active'
  ),
  visible as (
    -- En común: contadores de grupos de los dos.
    select c.*, 'common'::text as kind
      from public.counters c
     where c.group_id in (select group_id from their_groups)
       and c.group_id in (select group_id from my_groups)
    union all
    -- Para amigos: sus individuales no ocultos y los de sus grupos en los que no estoy.
    select c.*, 'public'::text
      from public.counters c, friends
     where friends.yes
       -- «Ocultar mis contadores a mis amigos» en Configuración: solo quedan los en común.
       and not (select pr.hide_counters_from_friends from public.profiles pr where pr.id = p_user_id)
       and (
         (c.group_id is null and c.owner_id = p_user_id and not c.hidden_from_friends)
         or (c.group_id in (select group_id from their_groups)
             and c.group_id not in (select group_id from my_groups))
       )
  )
  select
    v.id,
    v.name,
    v.emoji,
    v.unit,
    g.name,
    v.kind,
    coalesce((
      select sum(e.amount) from public.entries e
       where e.counter_id = v.id and e.user_id = p_user_id
         and case when v.group_id is null then not e.group_only else not e.personal_only end
    ), 0),
    case when v.kind = 'common' then coalesce((
      select sum(e.amount) from public.entries e, me
       where e.counter_id = v.id and e.user_id = me.id and not e.personal_only
    ), 0) end
  from visible v
  left join public.groups g on g.id = v.group_id
  where not v.archived
    and p_user_id <> (select id from me)
  order by v.kind, v.name;
$$;

-- Fotos de contador en el perfil de otras personas (petición del usuario).
--
-- * get_user_counters devuelve también photo_path (cambia lo que devuelve: hay que borrarla y
--   volver a crearla; el resto es igual que antes).
-- * can_see_counter_photo: además, las fotos de los contadores de grupo que el perfil de un amigo
--   enseña (los de grupos suyos en los que yo no estoy), igual que get_user_counters.

drop function public.get_user_counters(uuid);

create function public.get_user_counters(p_user_id uuid)
returns table (
  counter_id uuid,
  name text,
  emoji text,
  unit text,
  group_name text,
  kind text,
  their_total numeric,
  my_total numeric,
  photo_path text
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
    -- Si oculta sus números a sus amigos, en sus contadores (no en los en común) va null.
    case when v.kind = 'public'
              and (select pr.hide_counter_totals from public.profiles pr where pr.id = p_user_id)
         then null
         else coalesce((
           select sum(e.amount) from public.entries e
            where e.counter_id = v.id and e.user_id = p_user_id
              and case when v.group_id is null then not e.group_only else not e.personal_only end
         ), 0)
    end,
    case when v.kind = 'common' then coalesce((
      select sum(e.amount) from public.entries e, me
       where e.counter_id = v.id and e.user_id = me.id and not e.personal_only
    ), 0) end,
    v.photo_path
  from visible v
  left join public.groups g on g.id = v.group_id
  where p_user_id <> (select id from me)
  order by v.kind, v.name;
$$;

revoke all on function public.get_user_counters(uuid) from public, anon, authenticated;
grant execute on function public.get_user_counters(uuid) to authenticated;

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
         and (
           -- Individual de un amigo, visible para amigos.
           (c.group_id is null
             and not c.hidden_from_friends
             and public.are_friends(c.owner_id, (select auth.uid())))
           -- De un grupo con algún amigo mío dentro (sale en su perfil).
           or exists (
             select 1 from public.group_members m
              where m.group_id = c.group_id
                and m.status = 'active'
                and public.are_friends(m.user_id, (select auth.uid()))
           )
         )
    );
$$;

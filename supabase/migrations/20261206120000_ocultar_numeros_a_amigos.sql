-- Ocultar a mis amigos cuánto llevo (petición del usuario): siguen viendo mis contadores, pero
-- no el número. No afecta a los contadores en común (de grupos de los dos), donde el total ya
-- lo ven en la clasificación.

alter table public.profiles add column hide_counter_totals boolean not null default false;
grant update (hide_counter_totals) on public.profiles to authenticated;

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
    ), 0) end
  from visible v
  left join public.groups g on g.id = v.group_id
  where p_user_id <> (select id from me)
  order by v.kind, v.name;
$$;

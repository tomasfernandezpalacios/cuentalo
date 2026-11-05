-- Perfil de otros usuarios (petición del usuario).
--
-- * Mis amigos ven mis contadores individuales salvo los que marque como ocultos para ellos
--   (hidden_from_friends, por defecto false) y los de mis grupos.
-- * Con quien comparto grupo (sea o no mi amigo) veo los contadores en común: los de esos grupos.
-- * Solo se ven totales, nunca los registros: lo devuelve una función SECURITY DEFINER.

alter table public.counters add column hidden_from_friends boolean not null default false;
grant update (hidden_from_friends) on public.counters to authenticated;

-- Contadores de otro usuario que puedo ver, con su total y (si son en común) el mío.
--   kind = 'public': suyos que me enseña por ser su amigo (individuales no ocultos y de sus grupos).
--   kind = 'common': de grupos en los que estamos los dos.
-- Totales de grupo: lo que cuenta para el grupo (sin registros solo personales).
-- Totales individuales: lo que cuenta para él (sin copias para otros grupos).
create function public.get_user_counters(p_user_id uuid)
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

revoke execute on function public.get_user_counters(uuid) from public, anon;
grant execute on function public.get_user_counters(uuid) to authenticated;

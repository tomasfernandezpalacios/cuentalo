-- Al bloquear a alguien, quien bloquea recibe un aviso en el buzón («Has bloqueado a X»)
-- (petición del usuario, 2026-11-18). Nace leído, como los demás avisos de cosas que haces tú:
-- sale en «Avisos» pero no enciende el punto rojo. A la persona bloqueada no se le avisa.

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind = any (array[
  'friend_accepted', 'friend_you_accepted', 'request_approved', 'request_rejected',
  'counter_deleted', 'group_deleted', 'group_admin', 'member_left', 'new_leader',
  'you_are_leader', 'kicked', 'group_activity', 'user_blocked'
]::text[]));

create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_new boolean;
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
  v_new := found;

  delete from public.friendships f
   where (f.requester_id = v_me and f.addressee_id = p_user_id)
      or (f.requester_id = p_user_id and f.addressee_id = v_me);

  delete from public.group_members gm
   using public.groups g
   where gm.group_id = g.id
     and gm.status = 'invited'
     and ((gm.user_id = p_user_id and g.owner_id = v_me)
       or (gm.user_id = v_me and g.owner_id = p_user_id));

  -- Solo la primera vez (bloquear a alguien ya bloqueado no repite el aviso).
  if v_new then
    insert into public.notifications (user_id, kind, actor_id, actor_name, read_at)
    select v_me, 'user_blocked', p.id, p.display_name, now()
      from public.profiles p
     where p.id = p_user_id;
  end if;
end;
$$;
revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- Al aceptar una solicitud de amistad, ahora reciben un aviso los dos (petición del usuario):
-- * quien la envió: «X ha aceptado tu solicitud de amistad» (friend_accepted, como antes);
-- * quien la acepta: «Has aceptado la solicitud de amistad de X» (friend_you_accepted), con X
--   como actor para enseñar su nombre (y su nombre guardado por si borra la cuenta).

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'friend_accepted', 'friend_you_accepted', 'request_approved', 'request_rejected',
  'counter_deleted', 'group_deleted', 'group_admin', 'member_left', 'new_leader',
  'you_are_leader', 'kicked'
));

create or replace function public.notify_friend_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    perform public.notify(new.requester_id, 'friend_accepted');
    insert into public.notifications (user_id, kind, actor_id, actor_name)
    select new.addressee_id, 'friend_you_accepted', p.id, p.display_name
      from public.profiles p
     where p.id = new.requester_id;
  end if;
  return new;
end;
$$;

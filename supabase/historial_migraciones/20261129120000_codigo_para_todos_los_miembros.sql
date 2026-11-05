-- El código de unión del grupo deja de ser solo del líder: cualquier miembro activo lo ve, lo
-- comparte y puede generar uno nuevo (petición del usuario). Invitados y gente de fuera, no.
-- La columna groups.invite_code sigue sin poder leerse directamente.

create or replace function public.get_group_invite_code(p_group_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'not_group_member';
  end if;
  select g.invite_code into v_code from public.groups g where g.id = p_group_id;
  return v_code;
end;
$$;

create or replace function public.regenerate_group_invite_code(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'not_group_member';
  end if;
  loop
    v_code := public.generate_invite_code();
    exit when not exists (select 1 from public.groups g where g.invite_code = v_code);
  end loop;
  update public.groups set invite_code = v_code where id = p_group_id;
  return v_code;
end;
$$;

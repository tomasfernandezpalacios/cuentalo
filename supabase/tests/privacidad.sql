-- Pruebas de privacidad y permisos (RLS).
--
-- Cómo usarlo: pega TODO el archivo en el SQL Editor de Supabase y pulsa Run.
-- * Crea tres usuarios de prueba (Ana, Beto y Carla), hace las comprobaciones y al final
--   deshace todo con ROLLBACK: no deja nada en la base de datos.
-- * Si todo va bien verás una fila: "OK: todas las pruebas de privacidad han pasado".
-- * Si algo falla, verás un error "FALLO: …" que dice qué regla no se cumple.
--
-- Para "hacerse pasar" por un usuario se usa el rol authenticated y se fija el JWT
-- (request.jwt.claims), que es exactamente lo que hace Supabase con cada petición de la app.

begin;

-- Usuarios de prueba (el trigger crea sus perfiles).
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'ana@prueba.test', 'authenticated', 'authenticated',
   '{"username": "ana_prueba", "display_name": "Ana"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'beto@prueba.test', 'authenticated', 'authenticated',
   '{"username": "beto_prueba", "display_name": "Beto"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'carla@prueba.test', 'authenticated', 'authenticated',
   '{"username": "carla_prueba", "display_name": "Carla"}');

-- A partir de aquí actuamos como la app: rol authenticated + el usuario del JWT.
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 1. Contadores privados
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
insert into public.counters (id, name, unit)
  values ('10000000-0000-0000-0000-000000000001', 'Privado de Ana', 'cosas');
insert into public.entries (id, counter_id, amount)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 5);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.counters where id = '10000000-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'FALLO: Beto puede leer el contador privado de Ana'; end if;

  select count(*) into n from public.entries where counter_id = '10000000-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'FALLO: Beto puede leer los registros privados de Ana'; end if;

  select count(*) into n from public.counter_totals where counter_id = '10000000-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'FALLO: Beto ve el total del contador privado de Ana'; end if;

  begin
    insert into public.entries (counter_id, amount)
      values ('10000000-0000-0000-0000-000000000001', 1);
    raise exception 'FALLO: Beto puede registrar en el contador privado de Ana';
  exception when insufficient_privilege then null; -- esperado (RLS)
  end;

  begin
    insert into public.entries (counter_id, user_id, amount)
      values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 1);
    raise exception 'FALLO: Beto puede crear registros en nombre de Ana';
  exception when insufficient_privilege then null;
  end;

  update public.entries set amount = 999 where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Beto puede editar un registro de Ana'; end if;

  delete from public.entries where id = '20000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Beto puede borrar un registro de Ana'; end if;

  delete from public.counters where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: Beto puede borrar el contador de Ana'; end if;

  if public.remove_one_from_counter('10000000-0000-0000-0000-000000000001') then
    raise exception 'FALLO: Beto puede restar en el contador de Ana';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Amistades y grupos
-- ---------------------------------------------------------------------------

-- Ana crea un grupo; no puede invitar a Beto hasta que sean amigos.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
insert into public.groups (id, name) values ('30000000-0000-0000-0000-000000000001', 'Grupo de prueba');
do $$
begin
  begin
    insert into public.group_members (group_id, user_id)
      values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2');
    raise exception 'FALLO: se puede invitar a un grupo a alguien que no es amigo';
  exception when insufficient_privilege then null;
  end;
end $$;
insert into public.friendships (id, addressee_id)
  values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2');

-- Ana no puede aceptar su propia solicitud; Carla no la ve.
do $$
declare n int;
begin
  update public.friendships set status = 'accepted' where id = '40000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: quien envía una solicitud puede aceptarla'; end if;
end $$;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000c3", "role": "authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.friendships;
  if n <> 0 then raise exception 'FALLO: Carla ve amistades ajenas'; end if;
end $$;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}', true);
update public.friendships set status = 'accepted' where id = '40000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
insert into public.group_members (group_id, user_id)
  values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2');

-- Beto, invitado pero sin aceptar, aún no ve los contadores del grupo.
insert into public.counters (id, name, unit, group_id)
  values ('10000000-0000-0000-0000-000000000002', 'Compartido', 'cosas',
          '30000000-0000-0000-0000-000000000001');
insert into public.entries (id, counter_id, amount)
  values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 3);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.counters where id = '10000000-0000-0000-0000-000000000002';
  if n <> 0 then raise exception 'FALLO: un invitado sin aceptar ve los contadores del grupo'; end if;
end $$;
update public.group_members set status = 'active'
  where group_id = '30000000-0000-0000-0000-000000000001'
    and user_id = '00000000-0000-0000-0000-0000000000b2';

-- ---------------------------------------------------------------------------
-- 3. Contadores compartidos
-- ---------------------------------------------------------------------------

do $$
declare n int; v_total numeric;
begin
  select count(*) into n from public.counters where id = '10000000-0000-0000-0000-000000000002';
  if n <> 1 then raise exception 'FALLO: un miembro activo no ve el contador del grupo'; end if;

  insert into public.entries (counter_id, amount)
    values ('10000000-0000-0000-0000-000000000002', 4);

  select count(*) into n from public.entries where counter_id = '10000000-0000-0000-0000-000000000002';
  if n <> 2 then raise exception 'FALLO: un miembro no ve los registros del grupo (ve %)', n; end if;

  select total into v_total from public.counter_totals
   where counter_id = '10000000-0000-0000-0000-000000000002';
  if v_total <> 7 then raise exception 'FALLO: total del grupo incorrecto (%)', v_total; end if;

  update public.entries set amount = 999 where id = '20000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: un miembro puede editar registros de otro'; end if;

  update public.counters set name = 'Cambiado por Beto'
   where id = '10000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: un miembro que no es creador ni owner edita el contador'; end if;

  select count(*) into n
    from public.get_leaderboard('10000000-0000-0000-0000-000000000002', 'all');
  if n <> 2 then raise exception 'FALLO: la clasificación no tiene 2 miembros (%)', n; end if;

  select count(*) into n
    from public.get_leaderboard('10000000-0000-0000-0000-000000000002', 'week')
   where "position" = 1 and username = 'beto_prueba' and total = 4;
  if n <> 1 then raise exception 'FALLO: la clasificación semanal no pone a Beto primero con 4'; end if;
end $$;

-- Carla (ajena al grupo) no ve nada del grupo ni puede usar la clasificación.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000c3", "role": "authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.groups where id = '30000000-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'FALLO: Carla ve un grupo ajeno'; end if;

  select count(*) into n from public.counters where id = '10000000-0000-0000-0000-000000000002';
  if n <> 0 then raise exception 'FALLO: Carla ve un contador compartido ajeno'; end if;

  select count(*) into n from public.entries where counter_id = '10000000-0000-0000-0000-000000000002';
  if n <> 0 then raise exception 'FALLO: Carla ve registros de un grupo ajeno'; end if;

  begin
    perform public.get_leaderboard('10000000-0000-0000-0000-000000000002', 'all');
    raise exception 'FALLO: Carla puede ver la clasificación de un grupo ajeno';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;

  begin
    insert into public.entries (counter_id, amount)
      values ('10000000-0000-0000-0000-000000000002', 1);
    raise exception 'FALLO: Carla puede registrar en un contador de un grupo ajeno';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.get_group_invite_code('30000000-0000-0000-0000-000000000001');
    raise exception 'FALLO: Carla puede leer el código de invitación';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Salir del grupo conserva las estadísticas personales
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}', true);
delete from public.group_members
  where group_id = '30000000-0000-0000-0000-000000000001'
    and user_id = '00000000-0000-0000-0000-0000000000b2';
do $$
declare n int;
begin
  select count(*) into n from public.entries
   where counter_id = '10000000-0000-0000-0000-000000000002'
     and user_id = '00000000-0000-0000-0000-0000000000b2';
  if n <> 1 then raise exception 'FALLO: al salir del grupo se pierden los registros propios'; end if;

  select count(*) into n from public.entries
   where counter_id = '10000000-0000-0000-0000-000000000002'
     and user_id <> '00000000-0000-0000-0000-0000000000b2';
  if n <> 0 then raise exception 'FALLO: tras salir se siguen viendo registros del grupo'; end if;

  select count(*) into n from public.counters where id = '10000000-0000-0000-0000-000000000002';
  if n <> 1 then raise exception 'FALLO: tras salir no se ve el contador en las estadísticas'; end if;

  begin
    insert into public.entries (counter_id, amount)
      values ('10000000-0000-0000-0000-000000000002', 1);
    raise exception 'FALLO: tras salir del grupo se puede seguir registrando';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Y el grupo ya no cuenta a Beto.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.entries where counter_id = '10000000-0000-0000-0000-000000000002';
  if n <> 1 then raise exception 'FALLO: el grupo sigue viendo registros de quien salió'; end if;
end $$;

-- Deshace todo: no queda ningún usuario ni dato de prueba.
rollback;

select 'OK: todas las pruebas de privacidad han pasado' as resultado;

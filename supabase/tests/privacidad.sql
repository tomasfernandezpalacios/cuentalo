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

-- Rachas: el registro de Ana apunta su día de actividad y Beto no puede verlo.
do $$
declare n int;
begin
  select count(*) into n from public.user_activity_days;
  if n <> 0 then raise exception 'FALLO: Beto ve los días de actividad de Ana'; end if;
end $$;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.user_activity_days
   where day = (now() at time zone 'Europe/Madrid')::date;
  if n <> 1 then raise exception 'FALLO: registrar no apunta el día de racha (%)', n; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1b. Carpetas: son personales
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select public.save_folder(null, 'Carpeta de Ana', array['10000000-0000-0000-0000-000000000001']::uuid[]);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}', true);
do $$
declare n int; v_folder uuid;
begin
  select count(*) into n from public.folders;
  if n <> 0 then raise exception 'FALLO: Beto ve las carpetas de Ana'; end if;

  select count(*) into n from public.folder_counters;
  if n <> 0 then raise exception 'FALLO: Beto ve el contenido de las carpetas de Ana'; end if;

  -- Beto no puede meter en su carpeta un contador que no ve.
  v_folder := public.save_folder(null, 'Carpeta de Beto', '{}'::uuid[]);
  begin
    insert into public.folder_counters (folder_id, counter_id)
      values (v_folder, '10000000-0000-0000-0000-000000000001');
    raise exception 'FALLO: se puede meter en una carpeta un contador ajeno';
  exception when insufficient_privilege then null;
  end;
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
-- 3b. Contador común
-- ---------------------------------------------------------------------------

-- Ana crea un contador común con ella y Beto como participantes.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
insert into public.counters (id, name, unit, group_id, is_common)
  values ('10000000-0000-0000-0000-000000000003', 'Viajes', 'viajes',
          '30000000-0000-0000-0000-000000000001', true);
select public.set_counter_participants('10000000-0000-0000-0000-000000000003',
  array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2']::uuid[]);

-- Beto (miembro, no administrador) no puede sumar directamente: envía una solicitud.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}', true);
do $$
begin
  begin
    perform public.add_to_common_counter('10000000-0000-0000-0000-000000000003', 1);
    raise exception 'FALLO: en un común suma alguien que no es el administrador';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;

  begin
    perform public.set_counter_participants('10000000-0000-0000-0000-000000000003',
      array['00000000-0000-0000-0000-0000000000b2']::uuid[]);
    raise exception 'FALLO: un miembro que no es administrador cambia los participantes';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
end $$;
insert into public.counter_requests (id, counter_id, amount)
  values ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 1);

-- Ana (administradora) acepta: se apunta a los dos y a Beto le llega el aviso.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.counter_requests where status = 'pending';
  if n <> 1 then raise exception 'FALLO: el administrador no ve la solicitud pendiente (%)', n; end if;

  perform public.decide_counter_request('50000000-0000-0000-0000-000000000001', true);

  select count(*) into n from public.entries
   where counter_id = '10000000-0000-0000-0000-000000000003' and amount = 1;
  if n <> 2 then raise exception 'FALLO: aceptar la solicitud no suma a todos (%)', n; end if;

  begin
    perform public.decide_counter_request('50000000-0000-0000-0000-000000000001', true);
    raise exception 'FALLO: una solicitud se puede aceptar dos veces';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;

  n := public.remove_one_from_common_counter('10000000-0000-0000-0000-000000000003');
  if n <> 2 then raise exception 'FALLO: el −1 común no resta a todos (%)', n; end if;

  n := public.remove_one_from_common_counter('10000000-0000-0000-0000-000000000003');
  if n <> 0 then raise exception 'FALLO: el −1 común baja de 0'; end if;
end $$;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.notifications where kind = 'request_approved';
  if n <> 1 then raise exception 'FALLO: a quien pidió no le llega el aviso de aceptada (%)', n; end if;
end $$;

-- Carla (ajena) no puede sumar ni cambiar participantes.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000c3", "role": "authenticated"}', true);
do $$
begin
  begin
    perform public.add_to_common_counter('10000000-0000-0000-0000-000000000003', 1);
    raise exception 'FALLO: alguien de fuera del grupo suma en un contador común';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;

  begin
    perform public.set_counter_participants('10000000-0000-0000-0000-000000000003',
      array['00000000-0000-0000-0000-0000000000c3']::uuid[]);
    raise exception 'FALLO: alguien de fuera cambia los participantes de un contador común';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 3c. Fusionar un contador individual con uno de grupo
-- ---------------------------------------------------------------------------

-- Beto tiene 100 en un contador privado y lo fusiona con el compartido del grupo (donde lleva 4).
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}', true);
insert into public.counters (id, name, unit)
  values ('10000000-0000-0000-0000-000000000004', 'Cervezas de Beto', 'cosas');
insert into public.entries (counter_id, amount)
  values ('10000000-0000-0000-0000-000000000004', 100);

do $$
declare n int; v_total numeric; v_target uuid;
begin
  -- No se pueden fusionar dos de grupo ni contadores comunes.
  begin
    perform public.merge_counters(
      array['10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003']::uuid[],
      null, null);
    raise exception 'FALLO: se pueden fusionar dos contadores de grupo o uno común';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;

  v_target := public.merge_counters(
    array['10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002']::uuid[],
    'Mis cervezas', '🍺');
  if v_target <> '10000000-0000-0000-0000-000000000002' then
    raise exception 'FALLO: al fusionar con uno de grupo no se queda el de grupo';
  end if;

  select count(*) into n from public.counters where id = '10000000-0000-0000-0000-000000000004';
  if n <> 0 then raise exception 'FALLO: el contador individual fusionado no desaparece'; end if;

  select my_total into v_total from public.counter_totals
   where counter_id = '10000000-0000-0000-0000-000000000002';
  if v_total <> 104 then raise exception 'FALLO: Beto no conserva su total personal (%)', v_total; end if;

  select total into v_total from public.get_leaderboard('10000000-0000-0000-0000-000000000002', 'all')
   where username = 'beto_prueba';
  if v_total <> 4 then raise exception 'FALLO: lo fusionado cuenta en la clasificación (%)', v_total; end if;

  select count(*) into n from public.counter_aliases
   where counter_id = '10000000-0000-0000-0000-000000000002' and name = 'Mis cervezas';
  if n <> 1 then raise exception 'FALLO: el nombre elegido no se guarda como alias personal'; end if;

  select count(*) into n from public.counters
   where id = '10000000-0000-0000-0000-000000000002' and name = 'Compartido';
  if n <> 1 then raise exception 'FALLO: fusionar cambia el nombre del contador del grupo'; end if;
end $$;

-- Ana no ve los registros antiguos de Beto ni le cuentan en el total del grupo.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
do $$
declare n int; v_total numeric;
begin
  select count(*) into n from public.entries
   where counter_id = '10000000-0000-0000-0000-000000000002' and personal_only;
  if n <> 0 then raise exception 'FALLO: Ana ve los registros solo personales de Beto'; end if;

  select total into v_total from public.counter_totals
   where counter_id = '10000000-0000-0000-0000-000000000002';
  if v_total <> 7 then raise exception 'FALLO: lo fusionado suma en el total del grupo (%)', v_total; end if;

  select count(*) into n from public.counter_aliases;
  if n <> 0 then raise exception 'FALLO: Ana ve los alias de Beto'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3d. Fusionar contadores de dos grupos (enlazados)
-- ---------------------------------------------------------------------------

-- Beto crea un segundo grupo con un contador donde lleva 5 y lo fusiona con el del primer grupo.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}', true);
insert into public.groups (id, name) values ('30000000-0000-0000-0000-000000000002', 'Grupo 2 de Beto');
insert into public.counters (id, name, unit, group_id)
  values ('10000000-0000-0000-0000-000000000005', 'Cervezas G2', 'cosas',
          '30000000-0000-0000-0000-000000000002');
insert into public.entries (counter_id, amount)
  values ('10000000-0000-0000-0000-000000000005', 5);
insert into public.counters (id, name, unit, group_id)
  values ('10000000-0000-0000-0000-000000000006', 'Otro del grupo 1', 'cosas',
          '30000000-0000-0000-0000-000000000001');

do $$
declare n int; v_total numeric; v_entry uuid;
begin
  -- Dos del mismo grupo no se pueden juntar.
  begin
    perform public.merge_counters(
      array['10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000006']::uuid[],
      null, null);
    raise exception 'FALLO: se pueden fusionar dos contadores del mismo grupo';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;

  perform public.merge_counters(
    array['10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005']::uuid[],
    null, null);

  select count(*) into n from public.counter_links where link_id is not null;
  if n <> 2 then raise exception 'FALLO: no se enlazan los dos contadores de grupo (%)', n; end if;

  -- +1 una vez: se apunta en los dos grupos.
  n := public.log_to_counter('10000000-0000-0000-0000-000000000002', 1);
  if n <> 2 then raise exception 'FALLO: el +1 no llega a los dos grupos (%)', n; end if;

  select total into v_total from public.get_leaderboard('10000000-0000-0000-0000-000000000002', 'all')
   where username = 'beto_prueba';
  if v_total <> 5 then raise exception 'FALLO: clasificación del grupo 1 incorrecta (%)', v_total; end if;

  select total into v_total from public.get_leaderboard('10000000-0000-0000-0000-000000000005', 'all')
   where username = 'beto_prueba';
  if v_total <> 6 then raise exception 'FALLO: clasificación del grupo 2 incorrecta (%)', v_total; end if;

  -- Personal: 104 + 5 + 1 (una sola vez) = 110.
  select sum(total) into v_total from public.entry_daily_totals
   where user_id = '00000000-0000-0000-0000-0000000000b2'
     and counter_id in ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005');
  if v_total <> 110 then raise exception 'FALLO: total personal duplicado o incompleto (%)', v_total; end if;

  -- Borrar el registro quita sus copias en los dos grupos.
  select id into v_entry from public.entries
   where counter_id = '10000000-0000-0000-0000-000000000002' and batch_id is not null
     and amount = 1 and not group_only
   limit 1;
  delete from public.entries
   where batch_id = (select batch_id from public.entries where id = v_entry);
  select count(*) into n from public.entries
   where batch_id is not null and amount = 1 and counter_id = '10000000-0000-0000-0000-000000000005';
  if n <> 0 then raise exception 'FALLO: borrar no quita la copia del otro grupo'; end if;
end $$;

-- Ana (solo en el grupo 1) no ve nada del grupo 2 ni los enlaces de Beto.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.entries where counter_id = '10000000-0000-0000-0000-000000000005';
  if n <> 0 then raise exception 'FALLO: Ana ve registros de un grupo ajeno'; end if;

  select count(*) into n from public.counter_links;
  if n <> 0 then raise exception 'FALLO: Ana ve los enlaces de Beto'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3e. Rachas de amigos: solo amigos aceptados y solo números
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
do $$
declare n int; v_streak int;
begin
  select count(*) into n from public.get_friends_streaks();
  if n <> 2 then raise exception 'FALLO: Ana no ve exactamente su racha y la de Beto (%)', n; end if;

  select current_streak into v_streak from public.get_friends_streaks()
   where username = 'ana_prueba';
  if v_streak < 1 then raise exception 'FALLO: la racha de Ana debería ser al menos 1 (%)', v_streak; end if;
end $$;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000c3", "role": "authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.get_friends_streaks() where username <> 'carla_prueba';
  if n <> 0 then raise exception 'FALLO: Carla ve rachas de quien no es su amigo'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3f. Perfil: lo que ven amigos y no amigos
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}', true);
insert into public.counters (id, name, unit) values
  ('10000000-0000-0000-0000-000000000007', 'Visible de Beto', 'cosas');
insert into public.counters (id, name, unit, hidden_from_friends) values
  ('10000000-0000-0000-0000-000000000008', 'Oculto de Beto', 'cosas', true);
insert into public.entries (counter_id, amount)
  values ('10000000-0000-0000-0000-000000000007', 7);

-- Ana (amiga y del mismo grupo) ve el visible con su total, no el oculto, y el compartido en común.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
do $$
declare n int; v_total numeric;
begin
  select their_total into v_total from public.get_user_counters('00000000-0000-0000-0000-0000000000b2')
   where name = 'Visible de Beto' and kind = 'public';
  if v_total is distinct from 7 then raise exception 'FALLO: una amiga no ve el contador visible (%)', v_total; end if;

  select count(*) into n from public.get_user_counters('00000000-0000-0000-0000-0000000000b2')
   where name = 'Oculto de Beto';
  if n <> 0 then raise exception 'FALLO: una amiga ve un contador oculto para amigos'; end if;

  select count(*) into n from public.get_user_counters('00000000-0000-0000-0000-0000000000b2')
   where counter_id = '10000000-0000-0000-0000-000000000002' and kind = 'common';
  if n <> 1 then raise exception 'FALLO: no sale el contador en común (%)', n; end if;
end $$;

-- Carla (ni amiga ni del grupo) no ve ningún contador de Beto.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000c3", "role": "authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.get_user_counters('00000000-0000-0000-0000-0000000000b2');
  if n <> 0 then raise exception 'FALLO: alguien que no es amigo ve contadores de otro (%)', n; end if;
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
  if n < 1 then raise exception 'FALLO: al salir del grupo se pierden los registros propios'; end if;

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

-- ---------------------------------------------------------------------------
-- 4b. Borrar un contador de grupo: nadie pierde sus registros
-- ---------------------------------------------------------------------------

-- Ana (administradora del contador compartido) lo borra del grupo.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
do $$
declare n int; v_total numeric;
begin
  -- Ana no administra el contador del grupo 2 de Beto: no puede borrarlo.
  begin
    perform public.delete_group_counter('10000000-0000-0000-0000-000000000005');
    raise exception 'FALLO: se puede borrar un contador de grupo sin ser su administrador';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
  end;

  -- Antes de borrar: Ana ve el aviso de amistad aceptada y no ve los avisos de Beto.
  select count(*) into n from public.notifications where kind = 'friend_accepted';
  if n <> 1 then raise exception 'FALLO: no llega el aviso de amistad aceptada (%)', n; end if;
  select count(*) into n from public.notifications where user_id <> '00000000-0000-0000-0000-0000000000a1';
  if n <> 0 then raise exception 'FALLO: Ana ve avisos de otros'; end if;

  perform public.delete_group_counter('10000000-0000-0000-0000-000000000002');

  select count(*) into n from public.counters where id = '10000000-0000-0000-0000-000000000002';
  if n <> 0 then raise exception 'FALLO: el contador de grupo no se borra'; end if;

  select sum(amount) into v_total from public.entries e
    join public.counters c on c.id = e.counter_id
   where c.group_id is null and c.name = 'Compartido'
     and e.user_id = '00000000-0000-0000-0000-0000000000a1';
  if v_total <> 3 then raise exception 'FALLO: Ana pierde sus registros al borrar (%)', v_total; end if;
end $$;

-- Beto lo tenía fusionado con el del grupo 2: sus registros siguen allí, solo para él.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}', true);
do $$
declare n int; v_total numeric;
begin
  select my_total into v_total from public.counter_totals
   where counter_id = '10000000-0000-0000-0000-000000000005';
  if v_total <> 109 then raise exception 'FALLO: Beto pierde registros al borrarse un contador (%)', v_total; end if;

  select total into v_total from public.get_leaderboard('10000000-0000-0000-0000-000000000005', 'all')
   where username = 'beto_prueba';
  if v_total <> 5 then raise exception 'FALLO: lo del grupo borrado suma en otro grupo (%)', v_total; end if;

  select count(*) into n from public.notifications where kind = 'counter_deleted';
  if n <> 1 then raise exception 'FALLO: no llega el aviso de contador borrado (%)', n; end if;

  -- Ocultos: personales.
  insert into public.hidden_counters (counter_id) values ('10000000-0000-0000-0000-000000000005');
end $$;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.hidden_counters;
  if n <> 0 then raise exception 'FALLO: Ana ve los contadores ocultos de Beto'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4b. Rendimiento: las funciones rápidas dan lo mismo que la RLS (migración 20261201)
-- ---------------------------------------------------------------------------

-- Para cada usuario de prueba: los contadores de get_my_home() son los que deja ver la RLS y
-- my_counter_totals() da los mismos totales que la vista counter_totals.
do $$
declare
  u text;
  diff int;
begin
  foreach u in array array[
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000b2',
    '00000000-0000-0000-0000-0000000000c3'
  ] loop
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);

    select count(*) into diff from (
      (select id from public.counters except select public.my_visible_counter_ids())
      union all
      (select public.my_visible_counter_ids() except select id from public.counters)
    ) x;
    if diff <> 0 then raise exception 'FALLO: my_visible_counter_ids no coincide con la RLS (%)', u; end if;

    select count(*) into diff from (
      (select counter_id, total, entry_count, last_logged_at, my_total, my_entry_count, my_group_total
         from public.counter_totals
       except
       select counter_id, total, entry_count, last_logged_at, my_total, my_entry_count, my_group_total
         from public.my_counter_totals())
      union all
      (select counter_id, total, entry_count, last_logged_at, my_total, my_entry_count, my_group_total
         from public.my_counter_totals()
       except
       select counter_id, total, entry_count, last_logged_at, my_total, my_entry_count, my_group_total
         from public.counter_totals)
    ) x;
    if diff <> 0 then raise exception 'FALLO: my_counter_totals no coincide con counter_totals (%)', u; end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Eliminar cuenta: solo borra la propia
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000c3", "role": "authenticated"}', true);
select public.delete_my_account();

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.profiles where id = '00000000-0000-0000-0000-0000000000c3';
  if n <> 0 then raise exception 'FALLO: eliminar cuenta no borra el perfil'; end if;

  select count(*) into n from public.profiles where id = '00000000-0000-0000-0000-0000000000a1';
  if n <> 1 then raise exception 'FALLO: eliminar una cuenta afecta a otros usuarios'; end if;
end $$;

-- Deshace todo: no queda ningún usuario ni dato de prueba.
rollback;

select 'OK: todas las pruebas de privacidad han pasado' as resultado;

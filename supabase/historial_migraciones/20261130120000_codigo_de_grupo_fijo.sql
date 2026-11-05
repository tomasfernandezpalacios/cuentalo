-- El código de unión de cada grupo es fijo (petición del usuario): se genera único al crear el
-- grupo (valor por defecto de groups.invite_code) y ya no se puede cambiar. Se quita la función
-- que generaba uno nuevo; la app ya no tiene ese botón.
drop function if exists public.regenerate_group_invite_code(uuid);

# Migraciones nuevas

El esquema completo está en [`../schema.sql`](../schema.sql) (estado final de todas las
migraciones hasta la `20261216130000`, ya aplicado en la base de datos). Las migraciones antiguas
están en [`../historial_migraciones/`](../historial_migraciones/) solo como referencia.

Cada cambio nuevo en la base de datos va aquí como un archivo
`AAAAMMDDHHMMSS_descripcion.sql`:

1. Se aplica en Supabase (con el conector de Supabase o pegándolo en el SQL Editor).
2. Se actualiza `schema.sql` para que siga reflejando la base de datos.
3. Si toca permisos o RLS, se amplía `../tests/privacidad.sql`.

Ojo: los privilegios por defecto de Supabase dan permisos sobre cada tabla y función nueva de
`public` a `anon` y `authenticated`. En cada migración, revoca lo que no haga falta
(`revoke all on … from public, anon, authenticated;`) y concede solo lo necesario.

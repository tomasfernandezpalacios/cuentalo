-- Permisos que se quedaron con los valores por defecto de Supabase.
--
-- my_counter_streaks se creó sin revocar los permisos por defecto: anon y authenticated podían
-- incluso intentar escribir en ella (no se puede: es una vista con agregados) y anon leerla
-- (no devolvía nada: sin sesión no hay registros propios). Como el resto: solo lectura y solo
-- con sesión.
revoke all on public.my_counter_streaks from anon, authenticated;
grant select on public.my_counter_streaks to authenticated;

-- set_joined_at() es una función de trigger: nadie necesita llamarla por la API.
revoke execute on function public.set_joined_at() from public, anon, authenticated;

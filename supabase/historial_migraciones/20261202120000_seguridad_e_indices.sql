-- Lo que señalan los asesores de Supabase (seguridad y rendimiento). No cambia nada de lo que
-- hace la app.

-- 1. Funciones de trigger: solo las ejecuta Postgres al dispararse el trigger (no se comprueba
--    EXECUTE), así que nadie necesita poder llamarlas por la API.
revoke execute on function
  public.handle_new_user(),
  public.handle_new_group(),
  public.notify_friend_accepted(),
  public.notify_kicked(),
  public.track_activity_day(),
  public.transfer_counters_on_leave(),
  public.dissolve_group_counters_on_delete()
from public, anon, authenticated;

-- 2. Sin sesión no se registra nada: la comprobación solo la usan las políticas de entries.
revoke execute on function public.can_log_to_counter(uuid) from public, anon;
grant execute on function public.can_log_to_counter(uuid) to authenticated;

-- 3. Claves foráneas sin índice (borrados en cascada al eliminar contadores o cuentas).
create index if not exists counter_links_counter_idx on public.counter_links (counter_id);
create index if not exists groups_owner_idx on public.groups (owner_id);
create index if not exists hidden_counters_counter_idx on public.hidden_counters (counter_id);
create index if not exists home_removed_counters_counter_idx
  on public.home_removed_counters (counter_id);
create index if not exists notifications_actor_idx on public.notifications (actor_id);

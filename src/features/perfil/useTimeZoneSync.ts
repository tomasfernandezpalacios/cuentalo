import { useEffect, useRef } from 'react';

import { useUserId } from '@/features/auth/AuthProvider';
import { deviceTimeZone } from '@/features/estadisticas/periods';
import { queryClient, refreshAll } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

/**
 * Guarda en el perfil la zona horaria del móvil (petición del usuario: todo en la hora del
 * móvil). Supabase la usa para contar los días de rachas, estadísticas y clasificaciones. Si
 * ha cambiado (p. ej. de viaje), se vuelven a pedir los datos para que los días cuadren.
 */
export function useTimeZoneSync(isSignedIn: boolean) {
  const userId = useUserId();
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || userId === '' || syncedFor.current === userId) return;
    syncedFor.current = userId;
    const zone = deviceTimeZone();
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('time_zone')
        .eq('id', userId)
        .maybeSingle();
      // Sin la migración (no hay columna) o ya está al día: nada que hacer.
      if (!data || data.time_zone === zone) return;
      const { error } = await supabase.rpc('set_my_time_zone', { p_time_zone: zone });
      if (!error) await refreshAll(queryClient);
    })();
  }, [isSignedIn, userId]);
}

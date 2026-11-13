import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useUserId } from '@/features/auth/AuthProvider';
import { fetchCounters } from '@/features/contadores/api';
import { fetchFolders, folderKeys } from '@/features/contadores/folders';
import { counterKeys } from '@/features/contadores/hooks';
import { fetchMyActivityDays, fetchMyDailyTotals } from '@/features/estadisticas/api';
import { fetchProfile, profileKeys } from '@/features/perfil/api';
import {
  fetchFriendships,
  fetchMyGroups,
  fetchNotices,
  fetchPendingCounterRequests,
} from '@/features/social/api';
import { socialKeys } from '@/features/social/hooks';

/**
 * Al entrar, se cargan por detrás los datos de las pestañas principales (contadores,
 * estadísticas, racha, amigos y grupos, buzón, perfil y carpetas), con las mismas claves que
 * usan sus pantallas. Así, al cambiar de pestaña ya está todo y se ve al instante, sin
 * «cargando». Si algo falla aquí no pasa nada: la pantalla lo vuelve a pedir al abrirse.
 */
/** Lo más que se espera a los datos antes de quitar la pantalla de carga (milisegundos). */
const MAX_WAIT_MS = 4000;

/**
 * Devuelve si ya ha terminado (o se ha esperado bastante): mientras tanto sigue la pantalla de
 * carga y, detrás, se dibujan todas las pestañas con sus datos, así al entrar no sale nada en
 * blanco (petición del usuario).
 */
export function usePrefetchMain(isSignedIn: boolean): boolean {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const [readyFor, setReadyFor] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || userId === '') return;
    const prefetch: { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }[] = [
      { queryKey: counterKeys.list(), queryFn: () => fetchCounters(userId) },
      {
        queryKey: [...counterKeys.all, 'daily-totals', userId],
        queryFn: () => fetchMyDailyTotals(userId),
      },
      {
        queryKey: [...counterKeys.all, 'activity', userId],
        queryFn: () => fetchMyActivityDays(userId),
      },
      { queryKey: socialKeys.friendships(userId), queryFn: () => fetchFriendships(userId) },
      { queryKey: socialKeys.groups(userId), queryFn: () => fetchMyGroups(userId) },
      { queryKey: socialKeys.notices(userId), queryFn: fetchNotices },
      {
        queryKey: socialKeys.requests(userId),
        queryFn: () => fetchPendingCounterRequests(userId),
      },
      { queryKey: profileKeys.detail(userId), queryFn: () => fetchProfile(userId) },
      { queryKey: folderKeys.all(userId), queryFn: fetchFolders },
    ];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setReadyFor(userId);
    };
    const timer = setTimeout(finish, MAX_WAIT_MS);
    void Promise.allSettled(prefetch.map((query) => queryClient.prefetchQuery(query))).then(finish);
    return () => {
      done = true;
      clearTimeout(timer);
    };
  }, [isSignedIn, userId, queryClient]);

  return !isSignedIn || userId === '' || readyFor === userId;
}

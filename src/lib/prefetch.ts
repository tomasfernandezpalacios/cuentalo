import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

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
export function usePrefetchMain(isSignedIn: boolean) {
  const queryClient = useQueryClient();
  const userId = useUserId();

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
    for (const query of prefetch) void queryClient.prefetchQuery(query);
  }, [isSignedIn, userId, queryClient]);
}

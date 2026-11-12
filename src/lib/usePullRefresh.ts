import { useState } from 'react';

/**
 * «Tirar para refrescar» que solo enseña el círculo cuando lo pide el usuario. Antes el círculo
 * iba ligado a cualquier recarga (`isRefetching`) y, como tras cada cambio se refresca todo por
 * detrás, salía arriba cada vez, como si la pantalla se estuviera recargando.
 */
export function usePullRefresh(refresh: () => Promise<unknown> | unknown) {
  const [refreshing, setRefreshing] = useState(false);
  return {
    refreshing,
    onRefresh: () => {
      setRefreshing(true);
      Promise.resolve(refresh()).finally(() => setRefreshing(false));
    },
  };
}

import { focusManager, QueryClient, type QueryKey } from '@tanstack/react-query';
import { AppState } from 'react-native';

/**
 * Tras cualquier cambio se refresca todo lo que está en pantalla, menos lo que no depende de los
 * datos: los enlaces firmados de las fotos (duran 1 h), las fotos y emoticonos de otras personas
 * en las clasificaciones y los códigos de grupo (solo cambian al expulsar, y ese cambio los
 * vuelve a pedir).
 *
 * **Por detrás y sin esperar** (petición del usuario: «primero que se vea, luego se guarda por
 * detrás»): no devuelve la promesa. Antes los `onSuccess` la devolvían y TanStack Query esperaba
 * a que se volvieran a pedir todas las consultas antes de dar el cambio por hecho: los botones
 * seguían girando y las pantallas tardaban en cerrarse.
 */
export function refreshAll(client: QueryClient = queryClient): void {
  void client.invalidateQueries({
    predicate: (query) => {
      const [first, second] = query.queryKey;
      if (
        first === 'profile-photo' ||
        first === 'counter-photo' ||
        first === 'avatar' ||
        first === 'profile-private'
      )
        return false;
      // La agenda resumida tampoco: leerla cuesta y no cambia por lo que se haga en la app.
      if (
        first === 'social' &&
        (second === 'photo' || second === 'invite-code' || second === 'contact-hashes')
      )
        return false;
      return true;
    },
  });
}

/** Deshace un cambio optimista (vuelve a dejar la caché como estaba). */
export type Undo = () => void;

/**
 * Cambio optimista: se aplica ya a lo que hay en caché (se ve al instante) y devuelve cómo
 * deshacerlo si el servidor dice que no. Para en seco cualquier petición en vuelo de esa consulta,
 * así una respuesta antigua no pisa el cambio.
 */
export async function optimistic<T>(
  client: QueryClient,
  queryKey: QueryKey,
  update: (old: T) => T,
): Promise<Undo> {
  await client.cancelQueries({ queryKey });
  const previous = client.getQueryData<T>(queryKey);
  if (previous !== undefined) client.setQueryData<T>(queryKey, update(previous));
  return () => client.setQueryData(queryKey, previous);
}

/**
 * Las tres partes de una mutación optimista: aplicar al momento, deshacer si falla y, al acabar,
 * refrescar por detrás para quedar igual que el servidor.
 */
export function optimisticHandlers<TVariables>(
  client: QueryClient,
  apply: (variables: TVariables) => Promise<Undo[]>,
) {
  return {
    onMutate: async (variables: TVariables) => ({ undo: await apply(variables) }),
    onError: (_error: unknown, _variables: TVariables, context?: { undo: Undo[] }) => {
      context?.undo.forEach((undo) => undo());
    },
    onSettled: () => refreshAll(client),
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
    // Sin conexión, los cambios fallan al momento (con su aviso y deshaciendo lo optimista) en
    // vez de quedarse en pausa: solo los +N y −1 esperan a la conexión (ver src/lib/offline.ts).
    mutations: { networkMode: 'always' },
  },
});

// En móvil no hay "foco de ventana": usamos el estado de la app para que, al volver a ella,
// se refresquen los datos que hayan cambiado (p. ej. solicitudes de amistad o invitaciones).
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (state) =>
    setFocused(state === 'active'),
  );
  return () => subscription.remove();
});

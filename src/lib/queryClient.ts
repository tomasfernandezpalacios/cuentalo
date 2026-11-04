import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

/**
 * Tras cualquier cambio se refresca todo lo que está en pantalla (así se ve al instante), menos
 * lo que no depende de los datos: los enlaces firmados de las fotos (duran 1 h), las fotos y
 * emoticonos de otras personas en las clasificaciones y los códigos de grupo (son fijos). Volver a pedirlos con cada +1 solo
 * gastaba conexión. (Al editar el perfil sí se refresca todo, ver useUpdateProfile.)
 */
export function refreshAll(client: QueryClient = queryClient) {
  return client.invalidateQueries({
    predicate: (query) => {
      const [first, second] = query.queryKey;
      if (first === 'profile-photo' || first === 'avatar') return false;
      if (first === 'social' && (second === 'photo' || second === 'invite-code')) return false;
      return true;
    },
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
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

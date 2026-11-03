import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

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

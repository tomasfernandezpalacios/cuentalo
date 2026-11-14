import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, isLoading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, isLoading: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, isLoading: false });
    });

    let lastUserId: string | null = null;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Al cerrar sesión, o si se pasa a otra cuenta sin cerrarla, borramos la caché para que
      // nadie vea datos de otro usuario (las claves de las consultas no llevan el usuario).
      const userId = session?.user.id ?? null;
      if (event === 'SIGNED_OUT' || (lastUserId && userId && userId !== lastUserId)) {
        queryClient.clear();
      }
      if (userId) lastUserId = userId;
      setState({ session, isLoading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/**
 * Id del usuario con sesión. Pensado para pantallas protegidas; durante el instante en que se
 * cierra sesión (antes de que la pantalla se desmonte) devuelve ''.
 */
export function useUserId(): string {
  const { session } = useAuth();
  return session?.user.id ?? '';
}

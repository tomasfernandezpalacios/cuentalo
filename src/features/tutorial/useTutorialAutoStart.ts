import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useUserId } from '@/features/auth/AuthProvider';
import { useCounterList } from '@/features/contadores/hooks';
import { profileKeys, type Profile } from '@/features/perfil/api';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

import { isTutorialActive, startTutorial } from './store';

/** Marca el tutorial como visto en el perfil (no vuelve a salir, tampoco en otro móvil). */
async function markTutorialDone(userId: string) {
  queryClient.setQueryData<Profile>(profileKeys.detail(userId), (old) =>
    old ? { ...old, tutorial_done: true } : old,
  );
  // Si falla (sin conexión), saldrá otra vez la próxima vez: no es grave.
  await supabase.from('profiles').update({ tutorial_done: true }).eq('id', userId);
}

/** ¿Tengo ya contadores en la lista? (Entonces el tutorial se salta «Crea tu primer contador».) */
function hasCounters(counters: { isActive: boolean; linkedInto: string | null }[]): boolean {
  return counters.some((c) => c.isActive && !c.linkedInto);
}

/** Empieza el tutorial desde «Mis contadores» (también desde Configuración → «Ver tutorial»). */
export function useStartTutorial() {
  const userId = useUserId();
  const counters = useCounterList();
  return () => {
    router.navigate('/');
    startTutorial(hasCounters(counters.data ?? []), () => void markTutorialDone(userId));
  };
}

/** La primera vez que alguien entra (tutorial_done = false en su perfil), sale solo. */
export function useTutorialAutoStart(isSignedIn: boolean) {
  const userId = useUserId();
  const counters = useCounterList();
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || userId === '' || counters.data === undefined) return;
    if (startedFor.current === userId || isTutorialActive()) return;
    let cancelled = false;
    // Se lee el perfil directamente para no depender de una pantalla que lo tenga cargado.
    supabase
      .from('profiles')
      .select('tutorial_done')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        // Solo si la columna existe y vale false (sin la migración, no sale nunca).
        if (cancelled || data?.tutorial_done !== false) return;
        startedFor.current = userId;
        startTutorial(hasCounters(counters.data ?? []), () => void markTutorialDone(userId));
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId, counters.data]);
}

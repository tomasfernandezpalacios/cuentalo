import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useUserId } from '@/features/auth/AuthProvider';
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

/** Empieza el tutorial desde «Mis contadores» (también desde Configuración → «Ver tutorial»). */
export function useStartTutorial() {
  const userId = useUserId();
  return () => {
    router.navigate('/');
    startTutorial(() => void markTutorialDone(userId));
  };
}

/** La primera vez que alguien entra (tutorial_done = false en su perfil), sale solo. */
export function useTutorialAutoStart(isSignedIn: boolean) {
  const userId = useUserId();
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || userId === '') return;
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
        startTutorial(() => void markTutorialDone(userId));
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId]);
}

import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

/** Extrae el código de un enlace de invitación (cuentalo://unirse/X o exp://…/--/unirse/X). */
export function parseInviteCode(url: string): string | null {
  const match = /\/?unirse\/([A-Za-z0-9-]+)/.exec(url);
  return match?.[1] ?? null;
}

/**
 * Si se abre un enlace de invitación sin sesión, Expo Router manda al login y el enlace se
 * perdería. Este hook lo recuerda y, en cuanto hay sesión, abre la pantalla de unirse.
 */
export function usePendingInvite(isSignedIn: boolean) {
  const url = Linking.useURL();
  const pending = useRef<string | null>(null);

  useEffect(() => {
    if (!url || isSignedIn) return;
    pending.current = parseInviteCode(url) ?? pending.current;
  }, [url, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn || !pending.current) return;
    const code = pending.current;
    pending.current = null;
    router.push({ pathname: '/unirse/[code]', params: { code } });
  }, [isSignedIn]);
}

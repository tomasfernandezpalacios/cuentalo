import * as Linking from 'expo-linking';

// Recuperar la contraseña con el enlace del correo de Supabase.
//
// El correo integrado de Supabase no deja cambiar la plantilla (haría falta un servidor de correo
// propio), así que el correo trae un enlace y no un código. Va con PKCE (`flowType: 'pkce'` en
// src/lib/supabase.ts): al pedirlo, el móvil guarda un secreto y el enlace vuelve a la app
// (cuentalo://restablecer, o exp://…/--/restablecer en Expo Go) con un `?code=…` que solo sirve
// junto a ese secreto. Así nadie puede fabricar un enlace que meta al usuario en otra cuenta
// (antes el enlace traía la sesión entera y la app la aceptaba sin más).

/** Dirección a la que vuelve el enlace del correo (tiene que estar permitida en Supabase). */
export function recoveryRedirectUrl(): string {
  return Linking.createURL('/restablecer');
}

export type RecoveryLink = { kind: 'code'; code: string } | { kind: 'error'; message: string };

/** Lee lo que trae el enlace (en la consulta ? o, por si acaso, en el fragmento #). */
export function parseRecoveryUrl(url: string): RecoveryLink | null {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const query = url.includes('?') ? (url.slice(url.indexOf('?') + 1).split('#')[0] ?? '') : '';
  const params = new URLSearchParams([query, hash].filter(Boolean).join('&'));
  const code = params.get('code');
  if (code) return { kind: 'code', code };
  const error = params.get('error_description') ?? params.get('error');
  if (error) return { kind: 'error', message: error.replace(/\+/g, ' ') };
  return null;
}

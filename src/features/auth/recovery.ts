import * as Linking from 'expo-linking';

// Recuperar la contraseña con el enlace del correo de Supabase.
//
// El correo integrado de Supabase no deja cambiar la plantilla (haría falta un servidor de correo
// propio), así que el correo trae un enlace y no un código. El enlace pasa por Supabase y vuelve
// a la app (cuentalo://restablecer, o exp://…/--/restablecer en Expo Go) con la sesión en el
// fragmento: #access_token=…&refresh_token=…&type=recovery. Con eso se entra y se elige la
// contraseña nueva.

/** Dirección a la que vuelve el enlace del correo (tiene que estar permitida en Supabase). */
export function recoveryRedirectUrl(): string {
  return Linking.createURL('/restablecer');
}

export type RecoveryLink =
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'error'; message: string };

/** Lee lo que trae el enlace (en el fragmento # o, por si acaso, en la consulta ?). */
export function parseRecoveryUrl(url: string): RecoveryLink | null {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const query = url.includes('?') ? (url.slice(url.indexOf('?') + 1).split('#')[0] ?? '') : '';
  const params = new URLSearchParams(hash || query);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'session', accessToken, refreshToken };
  const error = params.get('error_description') ?? params.get('error');
  if (error) return { kind: 'error', message: error.replace(/\+/g, ' ') };
  return null;
}

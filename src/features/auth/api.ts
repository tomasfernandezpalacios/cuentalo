import { supabase } from '@/lib/supabase';
import { normalizeUsername } from '@/lib/validation';

import { recoveryRedirectUrl } from './recovery';

export class UsernameTakenError extends Error {
  code = 'username_taken';
}

export class WrongLoginError extends Error {
  code = 'wrong_login';
}

/** ¿Lo escrito en «Email o nombre de usuario» es un email? (los nombres no llevan @). */
export function isEmailLogin(login: string): boolean {
  return login.includes('@');
}

/**
 * Inicia sesión con el email o con el nombre de usuario. Con el nombre, una función de la base
 * de datos da el email solo si la contraseña es la buena (así nadie saca emails ajenos).
 */
export async function signIn(login: string, password: string): Promise<void> {
  let email = login.trim();
  if (!isEmailLogin(email)) {
    const { data, error } = await supabase.rpc('login_email_for_username', {
      p_username: normalizeUsername(email),
      p_password: password,
    });
    if (error) throw error;
    if (!data) throw new WrongLoginError('El usuario o la contraseña no son correctos.');
    email = data;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** ¿Está libre este nombre de usuario? (se puede preguntar sin sesión). */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_username_available', {
    p_username: normalizeUsername(username),
  });
  if (error) throw error;
  return data;
}

type SignUpInput = {
  email: string;
  password: string;
  username: string;
  displayName: string;
};

/** Crea la cuenta. El perfil lo crea un trigger en la base de datos con estos metadatos. */
export async function signUp({ email, password, username, displayName }: SignUpInput) {
  const normalized = normalizeUsername(username);

  if (!(await isUsernameAvailable(normalized))) {
    throw new UsernameTakenError('Ese nombre de usuario ya está en uso. Elige otro.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { username: normalized, display_name: displayName.trim() } },
  });
  if (error) {
    // Si alguien lo cogió justo a la vez, el perfil no se puede crear (nombre único) y Auth
    // devuelve un error genérico de base de datos: se explica como nombre en uso.
    if (/database error saving new user/i.test(error.message)) {
      throw new UsernameTakenError('Ese nombre de usuario ya está en uso. Elige otro.');
    }
    throw error;
  }
  return { needsConfirmation: data.session === null };
}

/**
 * «¿Olvidaste tu contraseña?»: Supabase manda un correo con un enlace que vuelve a la app
 * (`app/restablecer.tsx`), entra en la cuenta y lleva a elegir la contraseña nueva.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: recoveryRedirectUrl(),
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

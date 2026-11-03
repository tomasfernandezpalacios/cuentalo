import { supabase } from '@/lib/supabase';
import { normalizeUsername } from '@/lib/validation';

export class UsernameTakenError extends Error {
  code = 'username_taken';
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
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

  const { data: available, error: rpcError } = await supabase.rpc('is_username_available', {
    p_username: normalized,
  });
  if (rpcError) throw rpcError;
  if (!available) throw new UsernameTakenError('Ese nombre de usuario ya está cogido.');

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { username: normalized, display_name: displayName.trim() } },
  });
  if (error) throw error;
  return { needsConfirmation: data.session === null };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

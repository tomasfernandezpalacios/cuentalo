import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';
import { UsernameTakenError } from '@/features/auth/api';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { normalizeUsername } from '@/lib/validation';

export type Profile = Tables<'profiles'>;

export const profileKeys = {
  detail: (userId: string) => ['profile', userId] as const,
};

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export type ProfileInput = { displayName: string; username: string };

export async function updateProfile(
  userId: string,
  current: Profile,
  { displayName, username }: ProfileInput,
): Promise<void> {
  const normalized = normalizeUsername(username);
  if (normalized !== current.username) {
    const { data: available, error } = await supabase.rpc('is_username_available', {
      p_username: normalized,
    });
    if (error) throw error;
    if (!available) throw new UsernameTakenError('Ese nombre de usuario ya está cogido.');
  }
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName.trim(), username: normalized })
    .eq('id', userId);
  if (error) throw error;
}

/**
 * Borra la cuenta y todos sus datos (ver la migración delete_my_account) y cierra la sesión en
 * este móvil. El cierre es local porque el usuario ya no existe en el servidor.
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' });
}

export function useProfile(userId: string) {
  return useQuery({
    queryKey: profileKeys.detail(userId),
    queryFn: () => fetchProfile(userId),
    enabled: userId !== '',
  });
}

export function useUpdateProfile(current: Profile | undefined) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) => {
      if (!current) throw new Error('Perfil no cargado');
      return updateProfile(userId, current, input);
    },
    // El nombre sale también en grupos y clasificaciones: refrescamos todo.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: deleteMyAccount });
}

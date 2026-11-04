import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';
import { UsernameTakenError } from '@/features/auth/api';
import type { Tables } from '@/lib/database.types';
import { toCsv } from '@/lib/csv';
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

export type PrivacySettings = Pick<
  Profile,
  'hide_streak' | 'hide_counters_from_friends' | 'group_invites'
>;

/** Cambia una opción de privacidad de mi perfil (Configuración → Privacidad). */
export function useUpdatePrivacy() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<PrivacySettings>) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
      if (error) throw error;
    },
    // Se ve el cambio al momento; si falla, se vuelve a leer el perfil.
    onMutate: (patch) => {
      queryClient.setQueryData<Profile>(profileKeys.detail(userId), (old) =>
        old ? { ...old, ...patch } : old,
      );
    },
    onError: () => queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) }),
  });
}

const EXPORT_PAGE = 1000;

/**
 * Todos mis registros en CSV: fecha, contador, cantidad, unidad y nota. Solo los míos (la RLS
 * ya lo garantiza al filtrar por user_id) y sin las copias internas de contadores enlazados.
 */
export async function exportMyEntriesCsv(userId: string): Promise<string> {
  const entries: Pick<Tables<'entries'>, 'logged_at' | 'amount' | 'note' | 'counter_id'>[] = [];
  for (let from = 0; ; from += EXPORT_PAGE) {
    const { data, error } = await supabase
      .from('entries')
      .select('logged_at, amount, note, counter_id')
      .eq('user_id', userId)
      .eq('group_only', false)
      .order('logged_at', { ascending: true })
      .range(from, from + EXPORT_PAGE - 1);
    if (error) throw error;
    entries.push(...data);
    if (data.length < EXPORT_PAGE) break;
  }

  // Nombre y unidad de cada contador (veo todos aquellos en los que tengo registros).
  const ids = [...new Set(entries.map((e) => e.counter_id))];
  const counters = new Map<string, { name: string; unit: string | null }>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from('counters')
      .select('id, name, unit')
      .in('id', ids.slice(i, i + 100));
    if (error) throw error;
    data.forEach((c) => counters.set(c.id, c));
  }

  const rows = [['fecha', 'contador', 'cantidad', 'unidad', 'nota']];
  for (const e of entries) {
    const counter = counters.get(e.counter_id);
    rows.push([
      e.logged_at,
      counter?.name ?? '',
      String(e.amount),
      counter?.unit ?? '',
      e.note ?? '',
    ]);
  }
  return toCsv(rows);
}

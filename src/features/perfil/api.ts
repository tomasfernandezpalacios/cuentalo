import { useQuery } from '@tanstack/react-query';

import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Profile = Tables<'profiles'>;

export const profileKeys = {
  detail: (userId: string) => ['profile', userId] as const,
};

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export function useProfile(userId: string) {
  return useQuery({
    queryKey: profileKeys.detail(userId),
    queryFn: () => fetchProfile(userId),
    enabled: userId !== '',
  });
}

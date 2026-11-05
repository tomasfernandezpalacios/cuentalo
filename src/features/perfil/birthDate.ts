import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';
import { getSettings, updateSettings } from '@/features/configuracion/settings';
import { supabase } from '@/lib/supabase';

// Fecha de nacimiento ('AAAA-MM-DD') de la cuenta, para el «Resumen vital». Está en
// profile_private: solo la ve y la cambia su dueño (los perfiles los lee cualquiera).

const birthDateKey = (userId: string) => ['profile-private', userId] as const;

async function saveBirthDate(birthDate: string): Promise<void> {
  const { error } = await supabase
    .from('profile_private')
    .upsert({ birth_date: birthDate, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function fetchBirthDate(): Promise<string | null> {
  const { data, error } = await supabase.from('profile_private').select('birth_date').maybeSingle();
  if (error) throw error;
  if (data?.birth_date) return data.birth_date;
  // Antes se guardaba solo en el móvil: si hay una, se pasa a la cuenta una vez.
  const local = getSettings().birthDate;
  if (local) {
    await saveBirthDate(local);
    updateSettings({ birthDate: null });
    return local;
  }
  return null;
}

/** Mi fecha de nacimiento, o null si aún no la he dado. */
export function useBirthDate() {
  const userId = useUserId();
  return useQuery({
    queryKey: birthDateKey(userId),
    queryFn: fetchBirthDate,
    enabled: userId !== '',
    staleTime: Infinity,
  });
}

export function useSetBirthDate() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveBirthDate,
    onSuccess: (_data, birthDate) => queryClient.setQueryData(birthDateKey(userId), birthDate),
  });
}

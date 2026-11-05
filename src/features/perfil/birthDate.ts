import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';
import { getSettings, updateSettings } from '@/features/configuracion/settings';
import { supabase } from '@/lib/supabase';

// Datos privados de la cuenta (profile_private: solo los ve y cambia su dueño):
// * la fecha de nacimiento ('AAAA-MM-DD') del «Resumen vital»;
// * el orden de los bloques de Estadísticas y si está el bloque de la edad;
// * el orden de mis contadores en «Mis contadores».

export type StatsBlock = 'chart' | 'streak' | 'age';
export const DEFAULT_STATS_BLOCKS: StatsBlock[] = ['chart', 'streak'];

type PrivateProfile = {
  birthDate: string | null;
  statsBlocks: StatsBlock[];
  counterOrder: string[];
};

const privateKey = (userId: string) => ['profile-private', userId] as const;

type Patch = Partial<{
  birth_date: string | null;
  stats_blocks: string[];
  counter_order: string[];
}>;

async function savePrivate(patch: Patch): Promise<void> {
  const { error } = await supabase
    .from('profile_private')
    .upsert({ ...patch, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function fetchPrivate(): Promise<PrivateProfile> {
  const { data, error } = await supabase
    .from('profile_private')
    .select('birth_date, stats_blocks, counter_order')
    .maybeSingle();
  if (error) throw error;
  let birthDate = data?.birth_date ?? null;
  // Antes la fecha se guardaba solo en el móvil: si hay una, se pasa a la cuenta una vez.
  const local = getSettings().birthDate;
  if (!birthDate && local) {
    await savePrivate({ birth_date: local });
    updateSettings({ birthDate: null });
    birthDate = local;
  }
  const blocks = (data?.stats_blocks ?? []).filter((b): b is StatsBlock =>
    ['chart', 'streak', 'age'].includes(b),
  );
  return {
    birthDate,
    statsBlocks: blocks.length > 0 ? blocks : DEFAULT_STATS_BLOCKS,
    counterOrder: data?.counter_order ?? [],
  };
}

function usePrivateProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: privateKey(userId),
    queryFn: fetchPrivate,
    enabled: userId !== '',
    staleTime: Infinity,
  });
}

/** Cambia algo de la cuenta privada: se ve al momento y, si falla, se vuelve a leer. */
function usePrivateMutation<T>(
  toPatch: (value: T) => Patch,
  apply: (old: PrivateProfile, value: T) => PrivateProfile,
) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: T) => savePrivate(toPatch(value)),
    onMutate: (value: T) => {
      queryClient.setQueryData<PrivateProfile>(privateKey(userId), (old) =>
        old ? apply(old, value) : old,
      );
    },
    onError: () => queryClient.invalidateQueries({ queryKey: privateKey(userId) }),
  });
}

/** Mi fecha de nacimiento, o null si aún no la he dado. */
export function useBirthDate() {
  const query = usePrivateProfile();
  return { ...query, data: query.data === undefined ? undefined : query.data.birthDate };
}

export function useSetBirthDate() {
  return usePrivateMutation<string>(
    (birthDate) => ({ birth_date: birthDate }),
    (old, birthDate) => ({ ...old, birthDate }),
  );
}

/** Bloques de Estadísticas, en su orden. */
export function useStatsBlocks(): StatsBlock[] {
  return usePrivateProfile().data?.statsBlocks ?? DEFAULT_STATS_BLOCKS;
}

export function useSetStatsBlocks() {
  return usePrivateMutation<StatsBlock[]>(
    (blocks) => ({ stats_blocks: blocks }),
    (old, statsBlocks) => ({ ...old, statsBlocks }),
  );
}

/** Orden de mis contadores en «Mis contadores» (ids; los que faltan van al final). */
export function useCounterOrder(): string[] {
  return usePrivateProfile().data?.counterOrder ?? [];
}

export function useSetCounterOrder() {
  return usePrivateMutation<string[]>(
    (order) => ({ counter_order: order }),
    (old, counterOrder) => ({ ...old, counterOrder }),
  );
}

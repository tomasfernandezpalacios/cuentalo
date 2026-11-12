import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { optimistic, optimisticHandlers } from '@/lib/queryClient';

export type Folder = { id: string; name: string; counterIds: string[] };

export const folderKeys = {
  all: (userId: string) => ['folders', userId] as const,
};

export async function fetchFolders(): Promise<Folder[]> {
  const [folders, links] = await Promise.all([
    supabase.from('folders').select('id, name').order('created_at', { ascending: true }),
    supabase.from('folder_counters').select('folder_id, counter_id'),
  ]);
  if (folders.error) throw folders.error;
  if (links.error) throw links.error;
  return folders.data.map((folder) => ({
    ...folder,
    counterIds: links.data.filter((l) => l.folder_id === folder.id).map((l) => l.counter_id),
  }));
}

export type FolderInput = { name: string; counterIds: string[] };

/** Crea (id null) o actualiza una carpeta con sus contadores. Devuelve su id. */
export async function saveFolder(id: string | null, input: FolderInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_folder', {
    p_folder_id: id,
    p_name: input.name.trim(),
    p_counter_ids: input.counterIds,
  });
  if (error) throw error;
  return data;
}

export async function deleteFolder(id: string): Promise<void> {
  const { error } = await supabase.from('folders').delete().eq('id', id);
  if (error) throw error;
}

export function useFolders() {
  const userId = useUserId();
  return useQuery({
    queryKey: folderKeys.all(userId),
    queryFn: fetchFolders,
    enabled: userId !== '',
  });
}

/** La carpeta nueva o cambiada se ve al instante en la barra; se guarda por detrás. */
export function useSaveFolder(id: string | null) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: (input: FolderInput) => saveFolder(id, input),
    ...optimisticHandlers(queryClient, async (input: FolderInput) => [
      await optimistic<Folder[]>(queryClient, folderKeys.all(userId), (folders) => {
        const folder = {
          id: id ?? `nueva-${Date.now()}`,
          name: input.name.trim(),
          counterIds: input.counterIds,
        };
        return id ? folders.map((f) => (f.id === id ? folder : f)) : [...folders, folder];
      }),
    ]),
  });
}

/** Añade contadores a una carpeta que ya existe (sin quitar los que tenía). */
export function useAddToFolder() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: ({ folder, counterIds }: { folder: Folder; counterIds: string[] }) =>
      saveFolder(folder.id, {
        name: folder.name,
        counterIds: [...new Set([...folder.counterIds, ...counterIds])],
      }),
    ...optimisticHandlers(
      queryClient,
      async ({ folder, counterIds }: { folder: Folder; counterIds: string[] }) => [
        await optimistic<Folder[]>(queryClient, folderKeys.all(userId), (folders) =>
          folders.map((f) =>
            f.id === folder.id
              ? { ...f, counterIds: [...new Set([...f.counterIds, ...counterIds])] }
              : f,
          ),
        ),
      ],
    ),
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: deleteFolder,
    ...optimisticHandlers(queryClient, async (id: string) => [
      await optimistic<Folder[]>(queryClient, folderKeys.all(userId), (folders) =>
        folders.filter((f) => f.id !== id),
      ),
    ]),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

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

export function useSaveFolder(id: string | null) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FolderInput) => saveFolder(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: folderKeys.all(userId) }),
  });
}

export function useDeleteFolder() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteFolder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: folderKeys.all(userId) }),
  });
}

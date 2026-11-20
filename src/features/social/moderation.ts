import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';
import { refreshAll } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

import { fetchProfilesByIds, type PublicProfile } from './api';

// Bloquear y denunciar (guía 1.2 de Apple y Reglamento de Servicios Digitales). Ver la migración
// 20261218120000: bloquear borra la amistad y las invitaciones entre los dos y ya no se pueden
// enviar solicitudes ni invitaciones; las denuncias solo se envían (las revisa el responsable en
// el panel de Supabase, tabla `reports`).

export type ReportKind = 'user' | 'group';
export type ReportReason =
  'offensive' | 'harassment' | 'impersonation' | 'spam' | 'sexual_violent' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Acoso o intimidación' },
  { value: 'offensive', label: 'Contenido ofensivo o que incita al odio' },
  { value: 'sexual_violent', label: 'Contenido sexual o violento' },
  { value: 'impersonation', label: 'Se hace pasar por otra persona' },
  { value: 'spam', label: 'Spam o publicidad' },
  { value: 'other', label: 'Otro motivo' },
];

export type BlockedUser = PublicProfile & { blockedAt: string };

const blockKeys = {
  all: ['social', 'blocks'] as const,
  mine: (userId: string) => ['social', 'blocks', userId] as const,
};

async function fetchMyBlocks(): Promise<BlockedUser[]> {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const profiles = await fetchProfilesByIds(data.map((b) => b.blocked_id));
  return data.flatMap((b) => {
    const profile = profiles.get(b.blocked_id);
    return profile ? [{ ...profile, blockedAt: b.created_at }] : [];
  });
}

async function blockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('block_user', { p_user_id: userId });
  if (error) throw error;
}

async function unblockUser(userId: string): Promise<void> {
  const { error } = await supabase.from('user_blocks').delete().eq('blocked_id', userId);
  if (error) throw error;
}

async function reportContent(input: {
  kind: ReportKind;
  targetId: string;
  reason: ReportReason;
  details?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('report_content', {
    p_kind: input.kind,
    p_target_id: input.targetId,
    p_reason: input.reason,
    p_details: input.details?.trim() || null,
  });
  if (error) throw error;
}

/** Las personas que he bloqueado (nadie sabe quién le ha bloqueado a él). */
export function useMyBlocks() {
  const userId = useUserId();
  return useQuery({
    queryKey: blockKeys.mine(userId),
    queryFn: fetchMyBlocks,
    enabled: userId !== '',
  });
}

/** ¿He bloqueado a esta persona? */
export function useIsBlocked(otherId: string | undefined): boolean {
  const blocks = useMyBlocks();
  return !!otherId && (blocks.data ?? []).some((b) => b.id === otherId);
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: blockUser,
    // Se refresca todo: amistades, sugerencias, invitaciones y la lista de bloqueados.
    onSettled: () => refreshAll(queryClient),
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: unblockUser,
    onMutate: async (blockedId: string) => {
      const key = blockKeys.mine(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BlockedUser[]>(key);
      queryClient.setQueryData<BlockedUser[]>(key, (old) => old?.filter((b) => b.id !== blockedId));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(blockKeys.mine(userId), context.previous);
    },
    onSettled: () => refreshAll(queryClient),
  });
}

export function useReportContent() {
  return useMutation({ mutationFn: reportContent });
}

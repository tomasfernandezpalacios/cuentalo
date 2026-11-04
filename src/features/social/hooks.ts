import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';

import {
  acceptInvitation,
  createGroup,
  deleteFriendship,
  deleteGroup,
  fetchFriendships,
  fetchGroup,
  fetchInviteCode,
  fetchMyGroups,
  inviteToGroup,
  joinGroupByCode,
  previewGroupByCode,
  removeMember,
  updateGroup,
  fetchGroupPhotoUrl,
  leaveGroup,
  resignGroupAdmin,
  transferGroupAdmin,
  type Group,
  type GroupInput,
  respondFriendRequest,
  searchProfiles,
  sendFriendRequest,
  decideCounterRequest,
  fetchNotices,
  fetchPendingCounterRequests,
  markNoticesRead,
  fetchPublicProfile,
  fetchUserCounters,
} from './api';

export const socialKeys = {
  all: ['social'] as const,
  friendships: (userId: string) => [...socialKeys.all, 'friendships', userId] as const,
  groups: (userId: string) => [...socialKeys.all, 'groups', userId] as const,
  group: (groupId: string) => [...socialKeys.all, 'group', groupId] as const,
  search: (query: string) => [...socialKeys.all, 'search', query] as const,
  inviteCode: (groupId: string) => [...socialKeys.all, 'invite-code', groupId] as const,
  preview: (code: string) => [...socialKeys.all, 'preview', code] as const,
  notices: (userId: string) => [...socialKeys.all, 'notices', userId] as const,
  requests: (userId: string) => [...socialKeys.all, 'counter-requests', userId] as const,
};

// Cualquier cambio social refresca todo lo que está en pantalla: son consultas pequeñas y así
// todas las pantallas quedan coherentes al instante.
function useSocialMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    // Todo, no solo lo social: un cambio en un grupo también cambia contadores y clasificaciones.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

// --- Consultas --------------------------------------------------------------------------------

export function useFriendships() {
  const userId = useUserId();
  return useQuery({
    queryKey: socialKeys.friendships(userId),
    queryFn: () => fetchFriendships(userId),
    enabled: userId !== '',
  });
}

export function useProfileSearch(query: string) {
  const userId = useUserId();
  const term = query.trim();
  return useQuery({
    queryKey: socialKeys.search(term),
    queryFn: () => searchProfiles(term, userId),
    enabled: userId !== '' && term.length >= 2,
  });
}

export function useMyGroups() {
  const userId = useUserId();
  return useQuery({
    queryKey: socialKeys.groups(userId),
    queryFn: () => fetchMyGroups(userId),
    enabled: userId !== '',
  });
}

export function useGroup(groupId: string) {
  return useQuery({ queryKey: socialKeys.group(groupId), queryFn: () => fetchGroup(groupId) });
}

// --- Amistades --------------------------------------------------------------------------------

export function useSendFriendRequest() {
  return useSocialMutation(sendFriendRequest);
}

export function useRespondFriendRequest() {
  return useSocialMutation(({ id, status }: { id: string; status: 'accepted' | 'rejected' }) =>
    respondFriendRequest(id, status),
  );
}

export function useDeleteFriendship() {
  return useSocialMutation(deleteFriendship);
}

// --- Grupos -----------------------------------------------------------------------------------

export function useCreateGroup() {
  return useSocialMutation(createGroup);
}

export function useUpdateGroup(group: Group | undefined) {
  return useSocialMutation((input: GroupInput) => {
    if (!group) throw new Error('Grupo no cargado');
    return updateGroup(group, input);
  });
}

/** Enlace temporal de la foto; se renueva antes de que caduque (dura 1 h). */
export function useGroupPhotoUrl(path: string | null) {
  return useQuery({
    queryKey: [...socialKeys.all, 'photo', path],
    queryFn: () => fetchGroupPhotoUrl(path ?? ''),
    enabled: path !== null,
    staleTime: 50 * 60_000,
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteGroup,
    onSuccess: (_result, groupId) => {
      queryClient.removeQueries({ queryKey: socialKeys.group(groupId) });
      // Al borrar el grupo sus contadores pasan a privados: se refresca todo.
      return queryClient.invalidateQueries();
    },
  });
}

export function useInviteToGroup(groupId: string) {
  return useSocialMutation((userId: string) => inviteToGroup(groupId, userId));
}

export function useAcceptInvitation() {
  const userId = useUserId();
  return useSocialMutation((groupId: string) => acceptInvitation(groupId, userId));
}

export function useTransferGroupAdmin() {
  return useSocialMutation(({ groupId, userId }: { groupId: string; userId: string }) =>
    transferGroupAdmin(groupId, userId),
  );
}

export function useResignGroupAdmin() {
  return useSocialMutation(resignGroupAdmin);
}

/** Salir de un grupo: también cambian mis contadores (dejo de ver los del grupo). */
export function useLeaveGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: leaveGroup,
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useRemoveMember() {
  return useSocialMutation(({ groupId, userId }: { groupId: string; userId: string }) =>
    removeMember(groupId, userId),
  );
}

// --- Códigos de invitación --------------------------------------------------------------------

export function useInviteCode(groupId: string, enabled: boolean) {
  return useQuery({
    queryKey: socialKeys.inviteCode(groupId),
    queryFn: () => fetchInviteCode(groupId),
    enabled,
  });
}

export function useGroupPreview(code: string) {
  return useQuery({ queryKey: socialKeys.preview(code), queryFn: () => previewGroupByCode(code) });
}

export function useJoinGroupByCode() {
  return useSocialMutation(joinGroupByCode);
}

// --- Buzón ------------------------------------------------------------------------------------

export function useNotices() {
  const userId = useUserId();
  return useQuery({
    queryKey: socialKeys.notices(userId),
    queryFn: fetchNotices,
    enabled: userId !== '',
  });
}

export function usePendingCounterRequests() {
  const userId = useUserId();
  return useQuery({
    queryKey: socialKeys.requests(userId),
    queryFn: () => fetchPendingCounterRequests(userId),
    enabled: userId !== '',
  });
}

export function useDecideCounterRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      decideCounterRequest(id, approve),
    // Si se acepta, cambian los totales: refrescamos todo.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useMarkNoticesRead() {
  return useSocialMutation(markNoticesRead);
}

/**
 * Cosas que esperan algo de mí (para el punto rojo): solicitudes de amistad recibidas,
 * invitaciones a grupos, solicitudes en mis contadores comunes y avisos sin leer.
 */
export function useInboxCount(): number {
  const friendships = useFriendships();
  const groups = useMyGroups();
  const requests = usePendingCounterRequests();
  const notices = useNotices();
  return (
    (friendships.data ?? []).filter((f) => f.status === 'pending' && f.direction === 'incoming')
      .length +
    (groups.data ?? []).filter((g) => g.status === 'invited').length +
    (requests.data ?? []).length +
    (notices.data ?? []).filter((n) => n.read_at === null).length
  );
}

// --- Perfil de otro usuario ------------------------------------------------------------------

export function usePublicProfile(userId: string) {
  return useQuery({
    queryKey: [...socialKeys.all, 'profile', userId],
    queryFn: () => fetchPublicProfile(userId),
  });
}

export function useUserCounters(userId: string) {
  return useQuery({
    // Cuelga también de social: cambia al hacerse amigos o entrar en un grupo.
    queryKey: [...socialKeys.all, 'user-counters', userId],
    queryFn: () => fetchUserCounters(userId),
  });
}

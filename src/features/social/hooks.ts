import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
  type Friendship,
  type Notice,
} from './api';
import { optimistic, optimisticHandlers, refreshAll } from '@/lib/queryClient';

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
    onSuccess: () => refreshAll(queryClient),
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
    // Mientras se escribe, se siguen viendo los resultados anteriores (sin parpadeos).
    placeholderData: keepPreviousData,
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

/** Al enviarla, la persona sale al momento de las sugerencias; se guarda por detrás. */
export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendFriendRequest,
    ...optimisticHandlers(queryClient, async (addresseeId: string) => {
      const key = [...socialKeys.all, 'suggestions'];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueriesData<{ id: string }[]>({ queryKey: key });
      queryClient.setQueriesData<{ id: string }[]>({ queryKey: key }, (old) =>
        old?.filter((s) => s.id !== addresseeId),
      );
      return [() => previous.forEach(([k, data]) => queryClient.setQueryData(k, data))];
    }),
  });
}

/** Aceptar o rechazar se ve al instante en la lista de amigos y en el buzón. */
export function useRespondFriendRequest() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'rejected' }) =>
      respondFriendRequest(id, status),
    ...optimisticHandlers(
      queryClient,
      async ({ id, status }: { id: string; status: 'accepted' | 'rejected' }) => [
        await optimistic<Friendship[]>(queryClient, socialKeys.friendships(userId), (list) =>
          list.map((f) => (f.id === id ? { ...f, status } : f)),
        ),
      ],
    ),
  });
}

/** Dejar de ser amigos o cancelar una solicitud: desaparece al instante. */
export function useDeleteFriendship() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: deleteFriendship,
    ...optimisticHandlers(queryClient, async (id: string) => [
      await optimistic<Friendship[]>(queryClient, socialKeys.friendships(userId), (list) =>
        list.filter((f) => f.id !== id),
      ),
    ]),
  });
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
      return refreshAll(queryClient);
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
    onSuccess: () => refreshAll(queryClient),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      removeMember(groupId, userId),
    onSuccess: (_result, { groupId }) => {
      refreshAll(queryClient);
      // Al expulsar a alguien el grupo estrena código (notify_kicked): el antiguo ya no vale.
      void queryClient.invalidateQueries({ queryKey: socialKeys.inviteCode(groupId) });
    },
  });
}

// --- Códigos de invitación --------------------------------------------------------------------

export function useInviteCode(groupId: string, enabled: boolean) {
  return useQuery({
    queryKey: socialKeys.inviteCode(groupId),
    queryFn: () => fetchInviteCode(groupId),
    enabled,
    // El código solo cambia al expulsar a alguien (y entonces se vuelve a pedir).
    staleTime: Infinity,
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
    onSuccess: () => refreshAll(queryClient),
  });
}

/** Al abrir el buzón, los avisos dejan de contar como nuevos al instante (adiós punto rojo). */
export function useMarkNoticesRead() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: markNoticesRead,
    ...optimisticHandlers(queryClient, async () => {
      const now = new Date().toISOString();
      return [
        await optimistic<Notice[]>(queryClient, socialKeys.notices(userId), (list) =>
          list.map((n) => (n.read_at ? n : { ...n, read_at: now })),
        ),
      ];
    }),
  });
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

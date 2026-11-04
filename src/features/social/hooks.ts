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
  regenerateInviteCode,
  removeMember,
  updateGroup,
  fetchGroupPhotoUrl,
  type Group,
  type GroupInput,
  respondFriendRequest,
  searchProfiles,
  sendFriendRequest,
} from './api';

export const socialKeys = {
  all: ['social'] as const,
  friendships: (userId: string) => [...socialKeys.all, 'friendships', userId] as const,
  groups: (userId: string) => [...socialKeys.all, 'groups', userId] as const,
  group: (groupId: string) => [...socialKeys.all, 'group', groupId] as const,
  search: (query: string) => [...socialKeys.all, 'search', query] as const,
  inviteCode: (groupId: string) => [...socialKeys.all, 'invite-code', groupId] as const,
  preview: (code: string) => [...socialKeys.all, 'preview', code] as const,
};

// Cualquier cambio social refresca amistades y grupos: son consultas pequeñas y así todas las
// pantallas quedan coherentes.
function useSocialMutation<TVariables, TResult>(fn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: socialKeys.all }),
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
      return queryClient.invalidateQueries({ queryKey: socialKeys.all });
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

export function useRegenerateInviteCode(groupId: string) {
  return useSocialMutation(() => regenerateInviteCode(groupId));
}

export function useGroupPreview(code: string) {
  return useQuery({ queryKey: socialKeys.preview(code), queryFn: () => previewGroupByCode(code) });
}

export function useJoinGroupByCode() {
  return useSocialMutation(joinGroupByCode);
}

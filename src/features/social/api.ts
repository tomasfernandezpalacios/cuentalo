import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { normalizeUsername } from '@/lib/validation';

export type PublicProfile = Pick<
  Tables<'profiles'>,
  'id' | 'username' | 'display_name' | 'avatar_url'
>;
export type Group = Tables<'groups'>;
export type GroupMember = Tables<'group_members'>;

/** Una amistad vista desde mi lado: quién es el otro y si la pedí yo o me la pidieron. */
export type Friendship = {
  id: string;
  status: 'pending' | 'accepted';
  direction: 'incoming' | 'outgoing';
  other: PublicProfile;
};

export type MyGroup = Group & { role: GroupMember['role']; status: GroupMember['status'] };
export type MemberWithProfile = GroupMember & { profile: PublicProfile };
export type GroupDetail = Group & { members: MemberWithProfile[] };

const PROFILE_COLUMNS = 'id, username, display_name, avatar_url';

export async function fetchProfilesByIds(ids: string[]): Promise<Map<string, PublicProfile>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).in('id', ids);
  if (error) throw error;
  return new Map(data.map((p) => [p.id, p]));
}

// --- Búsqueda y amistades ---------------------------------------------------------------------

/** Escapa los comodines de LIKE para que "_" o "%" se busquen tal cual. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function searchProfiles(query: string, myId: string): Promise<PublicProfile[]> {
  const term = normalizeUsername(query);
  if (term.length < 2) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .ilike('username', `${escapeLike(term)}%`)
    .neq('id', myId)
    .order('username')
    .limit(20);
  if (error) throw error;
  return data;
}

export async function fetchFriendships(myId: string): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const otherId = (f: (typeof data)[number]) =>
    f.requester_id === myId ? f.addressee_id : f.requester_id;
  const profiles = await fetchProfilesByIds(data.map(otherId));

  const result: Friendship[] = [];
  for (const f of data) {
    const direction = f.requester_id === myId ? 'outgoing' : 'incoming';
    const other = profiles.get(otherId(f));
    // Una solicitud rechazada desaparece para quien la rechazó; a quien la envió le sigue
    // apareciendo como pendiente, para no comunicarle el rechazo.
    if (!other || (f.status === 'rejected' && direction === 'incoming')) continue;
    const status = f.status === 'accepted' ? 'accepted' : 'pending';
    result.push({ id: f.id, status, direction, other });
  }
  return result;
}

export async function sendFriendRequest(addresseeId: string): Promise<void> {
  const { error } = await supabase.from('friendships').insert({ addressee_id: addresseeId });
  if (error) throw error;
}

export async function respondFriendRequest(
  id: string,
  status: 'accepted' | 'rejected',
): Promise<void> {
  const { error } = await supabase.from('friendships').update({ status }).eq('id', id);
  if (error) throw error;
}

/** Cancela una solicitud enviada o elimina una amistad. */
export async function deleteFriendship(id: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', id);
  if (error) throw error;
}

// --- Grupos -----------------------------------------------------------------------------------

export async function fetchMyGroups(myId: string): Promise<MyGroup[]> {
  const memberships = await supabase.from('group_members').select('*').eq('user_id', myId);
  if (memberships.error) throw memberships.error;
  const ids = memberships.data.map((m) => m.group_id);
  if (ids.length === 0) return [];

  const groups = await supabase.from('groups').select('*').in('id', ids).order('name');
  if (groups.error) throw groups.error;
  return groups.data.flatMap((group) => {
    const membership = memberships.data.find((m) => m.group_id === group.id);
    return membership ? [{ ...group, role: membership.role, status: membership.status }] : [];
  });
}

export async function fetchGroup(groupId: string): Promise<GroupDetail> {
  const [group, members] = await Promise.all([
    supabase.from('groups').select('*').eq('id', groupId).single(),
    supabase.from('group_members').select('*').eq('group_id', groupId),
  ]);
  if (group.error) throw group.error;
  if (members.error) throw members.error;

  const profiles = await fetchProfilesByIds(members.data.map((m) => m.user_id));
  const withProfiles = members.data.flatMap((m) => {
    const profile = profiles.get(m.user_id);
    return profile ? [{ ...m, profile }] : [];
  });
  // Primero el owner, luego activos y al final invitados; dentro, por nombre.
  const rank = (m: MemberWithProfile) => (m.role === 'owner' ? 0 : m.status === 'active' ? 1 : 2);
  withProfiles.sort(
    (a, b) => rank(a) - rank(b) || a.profile.display_name.localeCompare(b.profile.display_name),
  );
  return { ...group.data, members: withProfiles };
}

export async function createGroup(name: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert({ name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameGroup(groupId: string, name: string): Promise<void> {
  const { error } = await supabase.from('groups').update({ name: name.trim() }).eq('id', groupId);
  if (error) throw error;
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) throw error;
}

export async function inviteToGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId });
  if (error) throw error;
}

export async function acceptInvitation(groupId: string, myId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ status: 'active' })
    .eq('group_id', groupId)
    .eq('user_id', myId);
  if (error) throw error;
}

/** Expulsar a alguien, retirar su invitación, rechazar la mía o salir del grupo. */
export async function removeMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

import * as Linking from 'expo-linking';

import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { base64ToBytes } from '@/lib/base64';
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
  /** 'rejected' solo aparece en las que rechacé yo (a quien la envió le sigue saliendo pendiente). */
  status: 'pending' | 'accepted' | 'rejected';
  direction: 'incoming' | 'outgoing';
  other: PublicProfile;
};

export type MyGroup = Group & { role: GroupMember['role']; status: GroupMember['status'] };
export type MemberWithProfile = GroupMember & { profile: PublicProfile };
export type GroupDetail = Group & { members: MemberWithProfile[] };

const PROFILE_COLUMNS = 'id, username, display_name, avatar_url';
// Columnas legibles de groups (invite_code solo se obtiene con get_group_invite_code).
const GROUP_COLUMNS = 'id, name, owner_id, created_at, emoji, photo_path';
const PHOTO_BUCKET = 'group-photos';

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
    if (!other) continue;
    // A quien la envió, una solicitud rechazada le sigue apareciendo como pendiente, para no
    // comunicarle el rechazo. Quien la rechazó la ve como rechazada en su buzón.
    const status = f.status === 'rejected' && direction === 'outgoing' ? 'pending' : f.status;
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

  const groups = await supabase.from('groups').select(GROUP_COLUMNS).in('id', ids).order('name');
  if (groups.error) throw groups.error;
  return groups.data.flatMap((group) => {
    const membership = memberships.data.find((m) => m.group_id === group.id);
    return membership ? [{ ...group, role: membership.role, status: membership.status }] : [];
  });
}

export async function fetchGroup(groupId: string): Promise<GroupDetail> {
  const [group, members] = await Promise.all([
    supabase.from('groups').select(GROUP_COLUMNS).eq('id', groupId).single(),
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

/** Foto elegida en el selector, lista para subir. */
export type PickedPhoto = { uri: string; base64: string; mimeType: string };

/**
 * Datos del formulario de grupo. `photo`: una foto nueva, 'keep' para dejar la que hay o
 * 'remove' para quitarla (y usar el emoticono).
 */
export type GroupInput = { name: string; emoji: string; photo: PickedPhoto | 'keep' | 'remove' };

async function uploadGroupPhoto(groupId: string, photo: PickedPhoto): Promise<string> {
  const extension = photo.mimeType.split('/')[1] ?? 'jpg';
  // Nombre nuevo cada vez: así los enlaces firmados antiguos no muestran la foto nueva en caché.
  const path = `${groupId}/${Date.now()}.${extension}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, base64ToBytes(photo.base64), { contentType: photo.mimeType });
  if (error) throw error;
  return path;
}

async function removeGroupPhoto(path: string | null): Promise<void> {
  if (!path) return;
  // Si falla no pasa nada grave: el grupo ya no apunta a esa foto.
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

/** Enlace temporal (1 h) para ver la foto de un grupo. Solo funciona a sus miembros. */
export async function fetchGroupPhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function createGroup(input: GroupInput): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert({ name: input.name.trim(), emoji: input.emoji.trim() || null })
    .select(GROUP_COLUMNS)
    .single();
  if (error) throw error;
  if (typeof input.photo === 'object') {
    const photoPath = await uploadGroupPhoto(data.id, input.photo);
    await updateGroupRow(data.id, { photo_path: photoPath });
    return { ...data, photo_path: photoPath };
  }
  return data;
}

async function updateGroupRow(
  groupId: string,
  patch: { name?: string; emoji?: string | null; photo_path?: string | null },
): Promise<void> {
  const { error } = await supabase.from('groups').update(patch).eq('id', groupId);
  if (error) throw error;
}

/** Solo el owner: nombre, emoticono y foto. */
export async function updateGroup(group: Group, input: GroupInput): Promise<void> {
  let photoPath = group.photo_path;
  if (typeof input.photo === 'object') {
    photoPath = await uploadGroupPhoto(group.id, input.photo);
  } else if (input.photo === 'remove') {
    photoPath = null;
  }
  await updateGroupRow(group.id, {
    name: input.name.trim(),
    emoji: input.emoji.trim() || null,
    photo_path: photoPath,
  });
  if (photoPath !== group.photo_path) await removeGroupPhoto(group.photo_path);
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

// --- Códigos de invitación --------------------------------------------------------------------

export type GroupPreview = {
  groupId: string;
  name: string;
  memberCount: number;
  isMember: boolean;
};

/** Quita guiones y espacios y pasa a mayúsculas: "abcd-efgh" → "ABCDEFGH". */
export function normalizeInviteCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** "ABCDEFGH" → "ABCD-EFGH", más fácil de leer y dictar. */
export function formatInviteCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** Enlace que abre la app en la pantalla de unirse (en Expo Go usa exp://, en la app real cuentalo://). */
export function buildInviteLink(code: string): string {
  return Linking.createURL(`/unirse/${code}`);
}

export async function fetchInviteCode(groupId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_group_invite_code', { p_group_id: groupId });
  if (error) throw error;
  return data;
}

export async function regenerateInviteCode(groupId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_group_invite_code', {
    p_group_id: groupId,
  });
  if (error) throw error;
  return data;
}

export async function previewGroupByCode(code: string): Promise<GroupPreview | null> {
  const { data, error } = await supabase.rpc('preview_group_by_code', { p_code: code });
  if (error) throw error;
  const row = data[0];
  return row
    ? {
        groupId: row.group_id,
        name: row.name,
        memberCount: row.member_count,
        isMember: row.is_member,
      }
    : null;
}

export async function joinGroupByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_group_by_code', { p_code: code });
  if (error) throw error;
  return data;
}

// --- Buzón de avisos --------------------------------------------------------------------------

export type Notice = Tables<'notifications'> & { actor: PublicProfile | null };

export type CounterRequestItem = {
  id: string;
  amount: number;
  createdAt: string;
  counterName: string;
  counterEmoji: string | null;
  requester: PublicProfile | null;
};

/** Mis avisos (los 50 últimos), con quién los provocó. */
export async function fetchNotices(): Promise<Notice[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  const actors = await fetchProfilesByIds([
    ...new Set(data.map((n) => n.actor_id).filter((id): id is string => id !== null)),
  ]);
  return data.map((n) => ({ ...n, actor: n.actor_id ? (actors.get(n.actor_id) ?? null) : null }));
}

/** Solicitudes pendientes de otros en contadores comunes que administro. */
export async function fetchPendingCounterRequests(myId: string): Promise<CounterRequestItem[]> {
  const { data, error } = await supabase
    .from('counter_requests')
    .select('*')
    .eq('status', 'pending')
    .neq('requester_id', myId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  if (data.length === 0) return [];

  const [counters, profiles] = await Promise.all([
    supabase
      .from('counters')
      .select('id, name, emoji')
      .in('id', [...new Set(data.map((r) => r.counter_id))]),
    fetchProfilesByIds([...new Set(data.map((r) => r.requester_id))]),
  ]);
  if (counters.error) throw counters.error;
  return data.map((r) => {
    const counter = counters.data.find((c) => c.id === r.counter_id);
    return {
      id: r.id,
      amount: r.amount,
      createdAt: r.created_at,
      counterName: counter?.name ?? 'Contador',
      counterEmoji: counter?.emoji ?? null,
      requester: profiles.get(r.requester_id) ?? null,
    };
  });
}

export async function decideCounterRequest(id: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc('decide_counter_request', {
    p_request_id: id,
    p_approve: approve,
  });
  if (error) throw error;
}

export async function markNoticesRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw error;
}

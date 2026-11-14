import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/AuthProvider';
import { COUNTER_PHOTO_BUCKET } from '@/features/contadores/photos';
import { GROUP_PHOTO_BUCKET } from '@/features/social/api';
import { UsernameTakenError } from '@/features/auth/api';
import type { Tables } from '@/lib/database.types';
import { base64ToBytes } from '@/lib/base64';
import { localDateTime, toCsv } from '@/lib/csv';
import { supabase } from '@/lib/supabase';
import { normalizeUsername } from '@/lib/validation';
import { removePhotoFolders, type PickedPhoto } from '@/lib/photos';

export type Profile = Tables<'profiles'>;

export const profileKeys = {
  detail: (userId: string) => ['profile', userId] as const,
};

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

/** Foto elegida en el selector, lista para subir. */
// La foto elegida (galería, cámara o editor): un solo tipo para toda la app.
export type { PickedPhoto };

/**
 * Datos del formulario de perfil. `photo`: una foto nueva, 'keep' para dejar la que hay o
 * 'remove' para quitarla (y usar el emoticono o la inicial).
 */
export type ProfileInput = {
  displayName: string;
  username: string;
  emoji: string;
  photo: PickedPhoto | 'keep' | 'remove';
};

const PHOTO_BUCKET = 'profile-photos';

async function uploadProfilePhoto(userId: string, photo: PickedPhoto): Promise<string> {
  const extension = photo.mimeType.split('/')[1] ?? 'jpg';
  // Nombre nuevo cada vez: así los enlaces firmados antiguos no muestran la foto vieja en caché.
  const path = `${userId}/${Date.now()}.${extension}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, base64ToBytes(photo.base64), { contentType: photo.mimeType });
  if (error) throw error;
  return path;
}

/** Borra todas mis fotos de perfil menos `keep` (si falla, no pasa nada grave). */
async function removeMyPhotos(userId: string, keep: string | null = null): Promise<void> {
  const { data } = await supabase.storage.from(PHOTO_BUCKET).list(userId);
  const paths = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (paths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
}

/** Enlace temporal (1 h) para ver una foto de perfil. */
export async function fetchProfilePhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function updateProfile(
  userId: string,
  current: Profile,
  { displayName, username, emoji, photo }: ProfileInput,
): Promise<void> {
  const normalized = normalizeUsername(username);
  if (normalized !== current.username) {
    const { data: available, error } = await supabase.rpc('is_username_available', {
      p_username: normalized,
    });
    if (error) throw error;
    if (!available) throw new UsernameTakenError('Ese nombre de usuario ya está cogido.');
  }
  let photoPath = current.photo_path;
  if (typeof photo === 'object') photoPath = await uploadProfilePhoto(userId, photo);
  else if (photo === 'remove') photoPath = null;

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName.trim(),
      username: normalized,
      emoji: emoji.trim() || null,
      photo_path: photoPath,
    })
    .eq('id', userId);
  if (error) throw error;
  if (photoPath !== current.photo_path) await removeMyPhotos(userId, photoPath);
}

/**
 * Fotos de lo que desaparece con la cuenta (ver delete_my_account): mis contadores individuales
 * y los grupos que lidero en los que no queda nadie más (se borran; si queda alguien, el grupo
 * pasa a otro miembro con su foto).
 */
async function removeDoomedPhotos(userId: string): Promise<void> {
  const [counters, groups] = await Promise.all([
    supabase
      .from('counters')
      .select('id')
      .eq('owner_id', userId)
      .is('group_id', null)
      .not('photo_path', 'is', null),
    supabase.from('groups').select('id').eq('owner_id', userId).not('photo_path', 'is', null),
  ]);
  const groupIds = (groups.data ?? []).map((g) => g.id);
  const { data: others } = groupIds.length
    ? await supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds)
        .eq('status', 'active')
        .neq('user_id', userId)
    : { data: [] };
  const withOthers = new Set((others ?? []).map((m) => m.group_id));
  await Promise.all([
    removePhotoFolders(
      COUNTER_PHOTO_BUCKET,
      (counters.data ?? []).map((c) => c.id),
    ),
    removePhotoFolders(
      GROUP_PHOTO_BUCKET,
      groupIds.filter((id) => !withOthers.has(id)),
    ),
  ]);
}

/**
 * Borra la cuenta y todos sus datos (ver la migración delete_my_account) y cierra la sesión en
 * este móvil. El cierre es local porque el usuario ya no existe en el servidor.
 */
export async function deleteMyAccount(userId: string): Promise<void> {
  // Las fotos de Storage no se borran desde SQL: se quitan antes de borrar la cuenta.
  await removeMyPhotos(userId).catch(() => {});
  await removeDoomedPhotos(userId).catch(() => {});
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' });
}

export function useProfile(userId: string) {
  return useQuery({
    queryKey: profileKeys.detail(userId),
    queryFn: () => fetchProfile(userId),
    enabled: userId !== '',
  });
}

export function useUpdateProfile(current: Profile | undefined) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) => {
      if (!current) throw new Error('Perfil no cargado');
      return updateProfile(userId, current, input);
    },
    // El nombre sale también en grupos y clasificaciones: refrescamos todo, por detrás (sin
    // devolver la promesa, para no esperar a que llegue todo antes de dar el cambio por hecho).
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}

export function useDeleteAccount() {
  const userId = useUserId();
  return useMutation({ mutationFn: () => deleteMyAccount(userId) });
}

/** Enlace temporal de una foto de perfil; se renueva antes de que caduque (dura 1 h). */
export function useProfilePhotoUrl(path: string | null) {
  return useQuery({
    queryKey: ['profile-photo', path],
    queryFn: () => fetchProfilePhotoUrl(path ?? ''),
    enabled: path !== null,
    staleTime: 50 * 60_000,
  });
}

/** Emoticono y foto de alguien por su id (para las filas de clasificaciones). */
export function useAvatarOf(userId: string) {
  return useQuery({
    queryKey: ['avatar', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('emoji, photo_path')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export type PrivacySettings = Pick<
  Profile,
  'hide_streak' | 'hide_counter_totals' | 'group_invites'
>;

/** Cambia una opción de privacidad de mi perfil (Configuración → Privacidad). */
export function useUpdatePrivacy() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<PrivacySettings>) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
      if (error) throw error;
    },
    // Se ve el cambio al momento; si falla, se vuelve a leer el perfil.
    onMutate: (patch) => {
      queryClient.setQueryData<Profile>(profileKeys.detail(userId), (old) =>
        old ? { ...old, ...patch } : old,
      );
    },
    onError: () => queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) }),
  });
}

const EXPORT_PAGE = 1000;

/**
 * Todos mis registros en CSV: fecha, contador, cantidad, unidad y nota. Solo los míos (la RLS
 * ya lo garantiza al filtrar por user_id) y sin las copias internas de contadores enlazados.
 */
export async function exportMyEntriesCsv(userId: string): Promise<string> {
  const entries: Pick<Tables<'entries'>, 'logged_at' | 'amount' | 'note' | 'counter_id'>[] = [];
  for (let from = 0; ; from += EXPORT_PAGE) {
    const { data, error } = await supabase
      .from('entries')
      .select('logged_at, amount, note, counter_id')
      .eq('user_id', userId)
      .eq('group_only', false)
      .order('logged_at', { ascending: true })
      .range(from, from + EXPORT_PAGE - 1);
    if (error) throw error;
    entries.push(...data);
    if (data.length < EXPORT_PAGE) break;
  }

  // Nombre y unidad de cada contador (veo todos aquellos en los que tengo registros).
  const ids = [...new Set(entries.map((e) => e.counter_id))];
  const counters = new Map<string, { name: string; unit: string | null }>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from('counters')
      .select('id, name, unit')
      .in('id', ids.slice(i, i + 100));
    if (error) throw error;
    data.forEach((c) => counters.set(c.id, c));
  }

  const rows = [['fecha', 'contador', 'cantidad', 'unidad', 'nota']];
  for (const e of entries) {
    const counter = counters.get(e.counter_id);
    rows.push([
      localDateTime(e.logged_at),
      counter?.name ?? '',
      String(e.amount),
      counter?.unit ?? '',
      e.note ?? '',
    ]);
  }
  return toCsv(rows);
}

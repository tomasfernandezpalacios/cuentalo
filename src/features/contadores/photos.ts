import { useQuery } from '@tanstack/react-query';

import { base64ToBytes } from '@/lib/base64';
import type { PickedPhoto } from '@/lib/photos';
import { supabase } from '@/lib/supabase';

// Foto como icono de un contador (bucket privado 'counter-photos', ruta '<counter_id>/<ts>.<ext>').
// La sube quien puede editar el contador y la ve quien ve el contador (ver migración 20261212).

const BUCKET = 'counter-photos';

/** Lo que el formulario pide hacer con la foto: una nueva, dejar la que hay o quitarla. */
export type CounterPhotoChange = PickedPhoto | 'keep' | 'remove';

export async function uploadCounterPhoto(counterId: string, photo: PickedPhoto): Promise<string> {
  const extension = photo.mimeType.split('/')[1] ?? 'jpg';
  // Nombre nuevo cada vez: los enlaces firmados antiguos no muestran la foto nueva en caché.
  const path = `${counterId}/${Date.now()}.${extension}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, base64ToBytes(photo.base64), { contentType: photo.mimeType });
  if (error) throw error;
  return path;
}

export async function removeCounterPhoto(path: string | null): Promise<void> {
  if (!path) return;
  // Si falla no pasa nada grave: el contador ya no apunta a esa foto.
  await supabase.storage.from(BUCKET).remove([path]);
}

/**
 * Aplica el cambio de foto de un contador ya guardado: sube la nueva y borra la anterior.
 * Devuelve la ruta con la que queda (o null).
 */
export async function applyCounterPhoto(
  counterId: string,
  current: string | null,
  change: CounterPhotoChange | undefined,
): Promise<string | null> {
  if (change === undefined || change === 'keep') return current;
  const next = change === 'remove' ? null : await uploadCounterPhoto(counterId, change);
  const { error } = await supabase
    .from('counters')
    .update({ photo_path: next })
    .eq('id', counterId);
  if (error) throw error;
  if (current !== next) await removeCounterPhoto(current);
  return next;
}

/** Enlace temporal (1 h) para ver la foto de un contador. */
export function useCounterPhotoUrl(path: string | null) {
  return useQuery({
    queryKey: ['counter-photo', path],
    enabled: path !== null,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path ?? '', 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

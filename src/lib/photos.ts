import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { supabase } from '@/lib/supabase';

// Fotos de perfil y de grupo: elegirlas (galería o cámara) y preparar la ya guardada para
// editarla. Todas son cuadradas.

export type PickedPhoto = { uri: string; base64: string; mimeType: string };

/** Abre la galería o la cámara con recorte cuadrado. Devuelve null si se cancela. */
export async function pickPhoto(source: 'library' | 'camera'): Promise<PickedPhoto | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
    base64: true,
  };
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      appAlert('Sin acceso a la cámara', 'Permite el uso de la cámara en los ajustes del móvil.');
      return null;
    }
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.base64) {
    appAlert('No se ha podido usar la foto', 'Prueba con otra imagen.');
    return null;
  }
  return { uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' };
}

/**
 * Para editar hace falta la imagen en el móvil: si es la guardada (un enlace firmado de
 * Supabase), se descarga a la caché.
 */
export async function localCopy(uri: string): Promise<string> {
  if (!/^https?:\/\//.test(uri)) return uri;
  const file = await File.downloadFileAsync(uri, new Directory(Paths.cache), { idempotent: true });
  return file.uri;
}

/** Ancho y alto en píxeles de una imagen. */
export function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

/**
 * Borra todas las fotos guardadas en las carpetas `folders` de un bucket (las fotos se guardan
 * en '<id>/<ts>.<ext>'). Se llama antes de borrar lo que las usa: Storage no se borra desde SQL
 * y, una vez borrado el contador o el grupo, sus políticas ya no dejan tocarlas. Si falla no
 * pasa nada grave: nadie podría verlas.
 */
export async function removePhotoFolders(bucket: string, folders: string[]): Promise<void> {
  await Promise.all(
    folders.map(async (folder) => {
      const { data } = await supabase.storage.from(bucket).list(folder);
      const paths = (data ?? []).map((file) => `${folder}/${file.name}`);
      if (paths.length > 0) await supabase.storage.from(bucket).remove(paths);
    }),
  ).catch(() => {});
}

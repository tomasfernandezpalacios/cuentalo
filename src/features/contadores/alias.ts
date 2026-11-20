import type { PickedPhoto } from '@/lib/photos';

import type { CounterAlias } from './api';
import type { CounterPhotoChange } from './photos';

// Versión personal de un contador de grupo («Para mí»): lo que guardo en counter_aliases a
// partir del formulario. Cada campo igual al del grupo se guarda como null (= el del grupo), así
// si el administrador lo cambia después, me llega su cambio en lo que no he personalizado.

export type SharedLook = {
  name: string;
  emoji: string | null;
  unit: string | null;
  photoPath: string | null;
};

/** Lo que pide el formulario: nombre, emoticono, unidad y qué hacer con la foto. */
export type PersonalInput = {
  name: string;
  emoji: string;
  unit: string;
  photo: CounterPhotoChange | undefined;
};

/** Alias a guardar; `photo` es la foto nueva a subir (o null si no hay que subir ninguna). */
export type AliasPlan = { alias: CounterAlias; upload: PickedPhoto | null };

export function planAlias(
  input: PersonalInput,
  shared: SharedLook,
  current: CounterAlias | null,
): AliasPlan {
  const name = input.name.trim();
  const unit = input.unit.trim();
  const emoji = input.emoji.trim() || null;
  const base = {
    name: name === shared.name ? null : name,
    unit: unit === '' || unit === (shared.unit ?? '') ? null : unit,
  };
  const photo = input.photo;
  // Foto nueva: la mía.
  if (photo && typeof photo === 'object') {
    return { alias: { ...base, emoji: null, photoPath: null }, upload: photo };
  }
  // Foto sin tocar: la mía si tenía; si era la del grupo, la del grupo (sin imagen propia).
  if (photo === 'keep') {
    return { alias: { ...base, emoji: null, photoPath: current?.photoPath ?? null }, upload: null };
  }
  // Emoticono: si es el mismo que el del grupo (y el grupo no tiene foto), el del grupo.
  const sameAsShared = emoji === shared.emoji && shared.photoPath === null;
  return {
    alias: { ...base, emoji: sameAsShared ? null : emoji, photoPath: null },
    upload: null,
  };
}

/** ¿El alias no cambia nada? Entonces se borra la fila y se ve como en el grupo. */
export function isEmptyAlias(alias: CounterAlias): boolean {
  return (
    alias.name === null && alias.emoji === null && alias.unit === null && alias.photoPath === null
  );
}

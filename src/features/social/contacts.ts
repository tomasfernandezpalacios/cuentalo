import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
// La API «legacy» de expo-contacts es la que tiene permisos y lectura de la agenda estables.
import * as Contacts from 'expo-contacts/legacy';

import { useUserId } from '@/features/auth/AuthProvider';
import { refreshAll } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

import type { PublicProfile } from './api';
import { normalizePhone, phoneHashInput, uniquePhones } from './phone';

/** Una persona que quizá conozcas: contacto de tu agenda o amigo de tus amigos. */
export type Suggestion = Pick<
  PublicProfile,
  'id' | 'username' | 'display_name' | 'emoji' | 'photo_path'
> & { isContact: boolean; mutualCount: number };

/** Cuántas salen en «Amigos»; el resto, en «Descubrir más». */
export const SUGGESTIONS_PREVIEW = 20;

async function hashPhone(normalized: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, phoneHashInput(normalized));
}

/** Resúmenes de los números de la agenda (vacío si no hay permiso; nunca lo pide). */
async function readContactHashes(): Promise<string[]> {
  const permission = await Contacts.getPermissionsAsync();
  if (!permission.granted) return [];
  const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
  const raw = data.flatMap((c) => (c.phoneNumbers ?? []).map((p) => p.number ?? ''));
  return Promise.all(uniquePhones(raw).slice(0, 3000).map(hashPhone));
}

// --- Consultas --------------------------------------------------------------------------------

const keys = {
  phone: (userId: string) => ['social', 'phone', userId] as const,
  contactHashes: ['social', 'contact-hashes'] as const,
  suggestions: (userId: string, limit: number, contacts: number) =>
    ['social', 'suggestions', userId, limit, contacts] as const,
};

/** ¿He sincronizado mi número? */
export function useMyPhoneSynced() {
  const userId = useUserId();
  return useQuery({
    queryKey: keys.phone(userId),
    enabled: userId !== '',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phone_directory')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      // Sin la migración la tabla no existe: como si no estuviera sincronizado.
      if (error) return false;
      return data !== null;
    },
  });
}

/** Mi agenda resumida (solo si ya dimos permiso). Se guarda un buen rato: leerla cuesta. */
function useContactHashes() {
  return useQuery({
    queryKey: keys.contactHashes,
    queryFn: readContactHashes,
    staleTime: 30 * 60 * 1000,
  });
}

/** Personas que quizá conozcas (contactos primero y después amigos de amigos). */
export function useFriendSuggestions(limit: number) {
  const userId = useUserId();
  const hashes = useContactHashes();
  const contactHashes = hashes.data ?? [];
  return useQuery({
    queryKey: keys.suggestions(userId, limit, contactHashes.length),
    enabled: userId !== '' && !hashes.isPending,
    queryFn: async (): Promise<Suggestion[]> => {
      const { data, error } = await supabase.rpc('get_friend_suggestions', {
        p_contact_hashes: contactHashes,
        p_limit: limit,
        p_offset: 0,
      });
      if (error) {
        if (error.code === 'PGRST202') return []; // Sin la migración: sin sugerencias.
        throw error;
      }
      return data.map((s) => ({
        id: s.id,
        username: s.username,
        display_name: s.display_name,
        emoji: s.emoji,
        photo_path: s.photo_path,
        isContact: s.is_contact,
        mutualCount: s.mutual_count,
      }));
    },
  });
}

// --- Sincronizar ------------------------------------------------------------------------------

/**
 * Guarda mi número (resumido) para que mis contactos me encuentren y pide permiso para leer la
 * agenda. Si no da permiso a la agenda, el número queda guardado igualmente.
 */
export function useSyncPhone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (phone: string) => {
      const normalized = normalizePhone(phone);
      if (!normalized) throw new Error('Escribe un número de teléfono válido.');
      const { error } = await supabase.rpc('set_my_phone', {
        p_hash: await hashPhone(normalized),
      });
      if (error) throw error;
      const permission = await Contacts.requestPermissionsAsync();
      return { contactsAllowed: permission.granted };
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: keys.contactHashes });
      refreshAll(queryClient);
    },
  });
}

/** Deja de aparecer en los contactos de los demás (borra mi número). */
export function useUnsyncPhone() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('phone_directory').delete().eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => refreshAll(queryClient),
  });
}

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { TextField } from '@/components/TextField';
import { getErrorMessage } from '@/lib/errors';
import { fonts, proseFont, shape, useThemeColors } from '@/lib/theme';

import type { PublicProfile } from '../api';
import { type Suggestion, useMyPhoneSynced, useSyncPhone, useUnsyncPhone } from '../contacts';
import { useSendFriendRequest } from '../hooks';

import { PersonRow } from './PersonRow';

function showError(error: unknown) {
  appAlert('Error', getErrorMessage(error));
}

/** Por qué sale alguien: está en tu agenda y/o cuántos amigos tenéis en común. */
export function suggestionNote(s: Suggestion): string {
  const parts: string[] = [];
  if (s.isContact) parts.push('En tus contactos');
  if (s.mutualCount > 0) {
    parts.push(s.mutualCount === 1 ? '1 amigo en común' : `${s.mutualCount} amigos en común`);
  }
  return parts.join(' · ');
}

/** Lista de sugerencias con su botón «Añadir». */
export function SuggestionList({ suggestions }: { suggestions: Suggestion[] }) {
  const send = useSendFriendRequest();
  return (
    <View>
      {suggestions.map((s) => (
        <PersonRow
          key={s.id}
          profile={s as unknown as PublicProfile}
          note={suggestionNote(s)}
          actions={
            <AppButton
              small
              title="Añadir"
              onPress={() => send.mutate(s.id, { onError: showError })}
            />
          }
        />
      ))}
    </View>
  );
}

/**
 * Sincronizar mi número: lo guardo (resumido, nunca el número) para que mis contactos me
 * encuentren y doy permiso para ver cuáles de mis contactos están en Cuéntalo. Es voluntario.
 */
export function PhoneSyncCard() {
  const colors = useThemeColors();
  const synced = useMyPhoneSynced();
  const sync = useSyncPhone();
  const unsync = useUnsyncPhone();
  const [phone, setPhone] = useState('');

  if (synced.isPending) return null;

  if (synced.data) {
    return (
      <View style={styles.syncedRow}>
        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
        <Text style={[styles.syncedText, { color: colors.textMuted }]}>
          Tu número está sincronizado: tus contactos pueden encontrarte.
        </Text>
        <AppButton
          small
          variant="ghost"
          title="Quitar"
          loading={unsync.isPending}
          onPress={() =>
            appAlert('Quitar tu número', 'Tus contactos dejarán de encontrarte por tu teléfono.', [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Quitar',
                style: 'destructive',
                onPress: () => unsync.mutate(undefined, { onError: showError }),
              },
            ])
          }
        />
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardTitleRow}>
        <Ionicons name="call-outline" size={20} color={colors.primary} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>Encuentra a tus contactos</Text>
      </View>
      <Text style={[styles.explain, { color: colors.textMuted }]}>
        Sincroniza tu número para ver qué contactos tuyos usan Cuéntalo y para que ellos te
        encuentren a ti. Tu número no se guarda tal cual (solo un resumen cifrado) y puedes quitarlo
        cuando quieras.
      </Text>
      <TextField
        label="Tu número de teléfono"
        value={phone}
        onChangeText={setPhone}
        placeholder="600 11 22 33"
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      <AppButton
        title="Sincronizar"
        loading={sync.isPending}
        disabled={phone.replace(/\D/g, '').length < 9}
        onPress={() =>
          sync.mutate(phone, {
            onSuccess: ({ contactsAllowed }) => {
              setPhone('');
              if (!contactsAllowed) {
                appAlert(
                  'Sin acceso a tus contactos',
                  'Tu número ya está sincronizado. Para ver qué contactos tuyos están en Cuéntalo, permite el acceso a los contactos en los ajustes del móvil.',
                );
              }
            },
            onError: showError,
          })
        }
      />
    </View>
  );
}

/** Fila «Descubrir más» que abre la pantalla con todas las sugerencias y el buscador. */
export function DiscoverMoreRow() {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => router.push('/amigos/descubrir')}
      accessibilityRole="button"
      accessibilityLabel="Descubrir más personas"
      style={({ pressed }) => [
        styles.more,
        { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name="compass-outline" size={20} color={colors.primary} />
      <Text style={[styles.moreText, { color: colors.text }]}>Descubrir más</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function SuggestionsLoading() {
  const colors = useThemeColors();
  return <ActivityIndicator color={colors.primary} />;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: shape.card, padding: 14, gap: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontFamily: fonts.title },
  explain: { ...proseFont(14, 20) },
  syncedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncedText: { flex: 1, ...proseFont(13, 18) },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: shape.card,
    borderWidth: 1,
  },
  moreText: { flex: 1, fontSize: 15, fontFamily: fonts.title },
});

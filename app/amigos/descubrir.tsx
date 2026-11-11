import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { Section } from '@/components/Section';
import { TextField } from '@/components/TextField';
import type { PublicProfile } from '@/features/social/api';
import { useFriendSuggestions } from '@/features/social/contacts';
import { PersonRow } from '@/features/social/components/PersonRow';
import { PhoneSyncCard, SuggestionList } from '@/features/social/components/Suggestions';
import {
  useFriendships,
  useProfileSearch,
  useRespondFriendRequest,
  useSendFriendRequest,
} from '@/features/social/hooks';
import { getErrorMessage } from '@/lib/errors';
import { proseFont, useThemeColors } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

/** Cuántas sugerencias como mucho en esta pantalla. */
const DISCOVER_LIMIT = 100;

function showError(error: unknown) {
  appAlert('Error', getErrorMessage(error));
}

/**
 * «Descubrir más»: buscador de cualquier usuario y todas las personas «cercanas» (contactos de tu
 * agenda que están en Cuéntalo y amigos de tus amigos).
 */
export default function DiscoverScreen() {
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const search = useProfileSearch(useDebouncedValue(query));
  const suggestions = useFriendSuggestions(DISCOVER_LIMIT);
  const friendships = useFriendships();
  const send = useSendFriendRequest();
  const respond = useRespondFriendRequest();
  const byOtherId = new Map((friendships.data ?? []).map((f) => [f.other.id, f]));

  function searchAction(profile: PublicProfile) {
    const friendship = byOtherId.get(profile.id);
    if (!friendship) {
      return (
        <AppButton
          small
          title="Añadir"
          onPress={() => send.mutate(profile.id, { onError: showError })}
        />
      );
    }
    if (friendship.status === 'accepted') return <Tag text="Amigos" />;
    if (friendship.direction === 'outgoing') return <Tag text="Enviada" />;
    if (friendship.status === 'rejected') return <Tag text="Rechazada" />;
    return (
      <AppButton
        small
        title="Aceptar"
        onPress={() =>
          respond.mutate({ id: friendship.id, status: 'accepted' }, { onError: showError })
        }
      />
    );
  }

  const searching = query.trim().length >= 2;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <TextField
        label="Buscar a cualquier usuario"
        value={query}
        onChangeText={setQuery}
        placeholder="Nombre de usuario"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {searching ? (
        <View>
          {search.isFetching && !search.data ? <ActivityIndicator color={colors.primary} /> : null}
          {search.data?.length === 0 ? (
            <Text style={[styles.muted, { color: colors.textMuted }]}>
              No hay usuarios con ese nombre.
            </Text>
          ) : null}
          {search.data?.map((profile) => (
            <PersonRow key={profile.id} profile={profile} actions={searchAction(profile)} />
          ))}
        </View>
      ) : (
        <>
          <PhoneSyncCard />
          <Section title="Personas que quizá conozcas">
            {suggestions.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (suggestions.data ?? []).length === 0 ? (
              <Text style={[styles.muted, { color: colors.textMuted }]}>
                De momento no hay sugerencias. Saldrán tus contactos que usen Cuéntalo y los amigos
                de tus amigos.
              </Text>
            ) : (
              <SuggestionList suggestions={suggestions.data ?? []} />
            )}
          </Section>
        </>
      )}
    </ScrollView>
  );
}

function Tag({ text }: { text: string }) {
  const colors = useThemeColors();
  return <Text style={[styles.muted, { color: colors.textMuted }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20 },
  muted: { ...proseFont(14, 20), paddingVertical: 8 },
});

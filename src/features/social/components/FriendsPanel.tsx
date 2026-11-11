import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { Section } from '@/components/Section';
import { ErrorView } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

import type { Friendship, PublicProfile } from '../api';
import {
  useDeleteFriendship,
  useFriendships,
  useProfileSearch,
  useRespondFriendRequest,
  useSendFriendRequest,
} from '../hooks';

import { SUGGESTIONS_PREVIEW, useFriendSuggestions } from '../contacts';

import { PersonRow } from './PersonRow';
import { DiscoverMoreRow, PhoneSyncCard, SuggestionList } from './Suggestions';

function showError(error: unknown) {
  appAlert('Error', getErrorMessage(error));
}

export function FriendsPanel() {
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const search = useProfileSearch(useDebouncedValue(query));
  const friendships = useFriendships();
  const send = useSendFriendRequest();
  const respond = useRespondFriendRequest();
  const remove = useDeleteFriendship();
  const suggestions = useFriendSuggestions(SUGGESTIONS_PREVIEW);

  if (friendships.isError) {
    return <ErrorView error={friendships.error} onRetry={friendships.refetch} />;
  }

  const all = friendships.data ?? [];
  const incoming = all.filter((f) => f.status === 'pending' && f.direction === 'incoming');
  const outgoing = all.filter((f) => f.status === 'pending' && f.direction === 'outgoing');
  const friends = all.filter((f) => f.status === 'accepted');
  const byOtherId = new Map(all.map((f) => [f.other.id, f]));

  function confirmRemove(friendship: Friendship) {
    appAlert('Eliminar amigo', `¿Quieres dejar de ser amigo de ${friendship.other.display_name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => remove.mutate(friendship.id, { onError: showError }),
      },
    ]);
  }

  // Botón de cada resultado de búsqueda según la relación que ya tengamos.
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

  return (
    <View style={styles.container}>
      <TextField
        label="Buscar por nombre de usuario"
        value={query}
        onChangeText={setQuery}
        placeholder="ej. tomas"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {query.trim().length >= 2 ? (
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
      ) : null}

      {incoming.length > 0 ? (
        <Section title="Solicitudes recibidas">
          <View>
            {incoming.map((f) => (
              <PersonRow
                key={f.id}
                profile={f.other}
                actions={
                  <>
                    <AppButton
                      small
                      title="Aceptar"
                      onPress={() =>
                        respond.mutate({ id: f.id, status: 'accepted' }, { onError: showError })
                      }
                    />
                    <AppButton
                      small
                      variant="secondary"
                      title="Rechazar"
                      onPress={() =>
                        respond.mutate({ id: f.id, status: 'rejected' }, { onError: showError })
                      }
                    />
                  </>
                }
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title={`Tus amigos${friends.length > 0 ? ` (${friends.length})` : ''}`}>
        {friendships.isPending ? (
          <ActivityIndicator color={colors.primary} />
        ) : friends.length === 0 ? (
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            Todavía no tienes amigos. Búscalos por su nombre de usuario.
          </Text>
        ) : (
          <View>
            {friends.map((f) => (
              <PersonRow
                key={f.id}
                profile={f.other}
                actions={
                  <AppButton
                    small
                    variant="ghost"
                    title="Eliminar"
                    onPress={() => confirmRemove(f)}
                  />
                }
              />
            ))}
          </View>
        )}
      </Section>

      {/* Debajo de los amigos: sincronizar el número y personas que quizá conozcas. */}
      <Section title="Personas que quizá conozcas">
        <View style={styles.suggestions}>
          <PhoneSyncCard />
          {suggestions.isPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (suggestions.data ?? []).length > 0 ? (
            <SuggestionList suggestions={suggestions.data ?? []} />
          ) : null}
          <DiscoverMoreRow />
        </View>
      </Section>

      {outgoing.length > 0 ? (
        <Section title="Solicitudes enviadas">
          <View>
            {outgoing.map((f) => (
              <PersonRow
                key={f.id}
                profile={f.other}
                actions={
                  <AppButton
                    small
                    variant="ghost"
                    title="Cancelar"
                    onPress={() => remove.mutate(f.id, { onError: showError })}
                  />
                }
              />
            ))}
          </View>
        </Section>
      ) : null}
    </View>
  );
}

function Tag({ text }: { text: string }) {
  const colors = useThemeColors();
  return <Text style={[styles.tag, { color: colors.textMuted }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: { gap: 24 },
  suggestions: { gap: 12 },
  muted: { fontSize: 14, fontFamily: fonts.detail, paddingVertical: 8 },
  tag: { fontSize: 14, fontFamily: fonts.detail },
});

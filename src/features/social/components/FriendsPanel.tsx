import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { Section } from '@/components/Section';
import { ErrorView } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { useFriendsStreaks } from '@/features/estadisticas/api';
import { PersonAvatar } from '@/features/perfil/PersonAvatar';
import { getErrorMessage } from '@/lib/errors';
import { refreshAll } from '@/lib/queryClient';
import { fonts, proseFont, useThemeColors } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

import { inviteToGroup, type Friendship, type PublicProfile } from '../api';
import { openProfile } from '../openProfile';
import {
  useDeleteFriendship,
  useFriendships,
  useMyGroups,
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
  const queryClient = useQueryClient();
  const groups = useMyGroups();
  // Racha actual de cada amigo (los que la ocultan no salen).
  const friendStreaks = useFriendsStreaks();
  const streakOf = new Map((friendStreaks.data ?? []).map((row) => [row.userId, row]));

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

  /** Llama y días de racha junto al nombre (en color si hoy ya la ha mantenido). */
  function streakBadge(friendId: string) {
    const streak = streakOf.get(friendId);
    if (!streak || streak.current <= 0) return undefined;
    const color = streak.activeToday ? colors.flame : colors.textMuted;
    return (
      <View
        style={styles.streak}
        accessible
        accessibilityLabel={`${streak.current} ${streak.current === 1 ? 'día' : 'días'} de racha`}
      >
        <Ionicons name="flame" size={16} color={color} />
        <Text style={[styles.streakText, { color }]}>{streak.current}</Text>
      </View>
    );
  }

  /** Invitarle a uno de los grupos que lidero. */
  function inviteMenu(friendship: Friendship) {
    const led = (groups.data ?? []).filter((g) => g.status === 'active' && g.role === 'owner');
    if (led.length === 0) {
      appAlert(
        'Invitar a un grupo',
        'Solo el líder de un grupo puede invitar, y no lideras ninguno.',
      );
      return;
    }
    appAlert(`Invitar a ${friendship.other.display_name}`, '¿A qué grupo?', [
      ...led.map((g) => ({
        text: g.name,
        onPress: () =>
          inviteToGroup(g.id, friendship.other.id)
            .then(() => {
              refreshAll(queryClient);
              appAlert('Invitación enviada', `Le has invitado a «${g.name}».`);
            })
            .catch(showError),
      })),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  }

  /** Mantener pulsado un amigo: acciones rápidas sin entrar en su perfil. */
  function friendMenu(friendship: Friendship) {
    appAlert(
      friendship.other.display_name,
      `@${friendship.other.username}`,
      [
        { text: 'Ver perfil', onPress: () => openProfile(friendship.other.id) },
        { text: 'Invitar a un grupo', onPress: () => inviteMenu(friendship) },
        { text: 'Eliminar amigo', style: 'destructive', onPress: () => confirmRemove(friendship) },
        { text: 'Cerrar', style: 'cancel' },
      ],
      // Arriba, su foto o icono de perfil (no la advertencia: eliminar ya pide confirmación).
      {
        image: (
          <PersonAvatar
            name={friendship.other.display_name}
            emoji={friendship.other.emoji}
            photoPath={friendship.other.photo_path}
            size={64}
          />
        ),
      },
    );
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
                badge={streakBadge(f.other.id)}
                onLongPress={() => friendMenu(f)}
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
  streak: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  streakText: { fontSize: 14, fontFamily: fonts.title },
  suggestions: { gap: 12 },
  muted: { ...proseFont(14), paddingVertical: 8 },
  tag: { fontSize: 14, fontFamily: fonts.detail },
});

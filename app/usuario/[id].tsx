import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { Section } from '@/components/Section';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { useUserId } from '@/features/auth/AuthProvider';
import { CounterAvatar } from '@/features/contadores/components/CounterAvatar';
import { useFriendsStreaks } from '@/features/estadisticas/api';
import type { UserCounter } from '@/features/social/api';
import {
  useDeleteFriendship,
  useFriendships,
  usePublicProfile,
  useRespondFriendRequest,
  useSendFriendRequest,
  useUserCounters,
} from '@/features/social/hooks';
import { getErrorMessage } from '@/lib/errors';
import { formatWithUnit } from '@/lib/format';
import { PersonAvatar } from '@/features/perfil/PersonAvatar';
import { CommonCountersChart } from '@/features/social/components/CommonCountersChart';
import { fonts, useThemeColors } from '@/lib/theme';

function showError(error: unknown) {
  appAlert('Error', getErrorMessage(error));
}

/**
 * Perfil de otra persona. Si no es tu amiga: botón para enviarle solicitud y los contadores en
 * común (de vuestros grupos). Si lo es: además su racha y los contadores que te enseña. Los en
 * común van primero, con una gráfica que os compara, y debajo los suyos.
 */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const myId = useUserId();
  const profile = usePublicProfile(id);
  const counters = useUserCounters(id);
  const friendships = useFriendships();
  const streaks = useFriendsStreaks();
  const send = useSendFriendRequest();
  const respond = useRespondFriendRequest();
  const remove = useDeleteFriendship();

  if (id === myId) return <Redirect href="/perfil" />;
  if (profile.isPending || friendships.isPending) return <LoadingView />;
  if (profile.isError) return <ErrorView error={profile.error} onRetry={profile.refetch} />;

  const person = profile.data;
  const friendship = (friendships.data ?? []).find((f) => f.other.id === id);
  const isFriend = friendship?.status === 'accepted';
  const streak = (streaks.data ?? []).find((s) => s.userId === id);
  const publicCounters = (counters.data ?? []).filter((c) => c.kind === 'public');
  const commonCounters = (counters.data ?? []).filter((c) => c.kind === 'common');

  function confirmRemove() {
    if (!friendship) return;
    appAlert('Eliminar amigo', `¿Quieres dejar de ser amigo de ${person.display_name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => remove.mutate(friendship.id, { onError: showError }),
      },
    ]);
  }

  // Botones según la relación que tengamos.
  let friendshipBlock;
  if (!friendship) {
    friendshipBlock = (
      <AppButton
        title="Enviar solicitud de amistad"
        onPress={() => send.mutate(id, { onError: showError })}
        loading={send.isPending}
      />
    );
  } else if (friendship.status === 'pending' && friendship.direction === 'outgoing') {
    friendshipBlock = (
      <View style={styles.row2}>
        <AppButton
          title="Solicitud enviada"
          variant="secondary"
          disabled
          onPress={() => {}}
          style={styles.flex}
        />
        <AppButton
          title="Cancelar"
          variant="ghost"
          onPress={() => remove.mutate(friendship.id, { onError: showError })}
        />
      </View>
    );
  } else if (friendship.status === 'pending') {
    friendshipBlock = (
      <View style={styles.row2}>
        <AppButton
          title="Aceptar solicitud"
          onPress={() =>
            respond.mutate({ id: friendship.id, status: 'accepted' }, { onError: showError })
          }
          style={styles.flex}
        />
        <AppButton
          title="Rechazar"
          variant="secondary"
          onPress={() =>
            respond.mutate({ id: friendship.id, status: 'rejected' }, { onError: showError })
          }
          style={styles.flex}
        />
      </View>
    );
  } else if (friendship.status === 'rejected') {
    friendshipBlock = (
      <Text style={[styles.detail, styles.center, { color: colors.textMuted }]}>
        Rechazaste su solicitud de amistad.
      </Text>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          tintColor={colors.primary}
          colors={[colors.primary]}
          refreshing={false}
          onRefresh={() => {
            profile.refetch();
            counters.refetch();
            friendships.refetch();
            streaks.refetch();
          }}
        />
      }
    >
      <Stack.Screen options={{ title: person.display_name }} />

      <View style={styles.header}>
        <PersonAvatar
          name={person.display_name}
          emoji={person.emoji}
          photoPath={person.photo_path}
          size={96}
        />
        <Text style={[styles.name, { color: colors.text }]}>{person.display_name}</Text>
        <Text style={[styles.detail, { color: colors.textMuted }]}>@{person.username}</Text>
      </View>

      {friendshipBlock}

      {isFriend && person.hide_streak ? (
        <Text style={[styles.detail, { color: colors.textMuted }]}>
          {person.display_name} tiene su racha oculta.
        </Text>
      ) : null}

      {isFriend && !person.hide_streak ? (
        <View
          accessible
          accessibilityLabel={`Racha de ${streak?.current ?? 0} días. Mejor racha: ${streak?.best ?? 0}`}
          style={[
            styles.streak,
            {
              backgroundColor: streak?.activeToday ? `${colors.flame}1F` : colors.surface,
              borderColor: streak?.activeToday ? colors.flame : colors.border,
            },
          ]}
        >
          <Ionicons
            name="flame"
            size={40}
            color={streak?.activeToday ? colors.flame : colors.textMuted}
          />
          <View style={styles.flex}>
            <Text style={[styles.streakNumber, { color: colors.text }]}>
              {streak?.current ?? 0} {(streak?.current ?? 0) === 1 ? 'día' : 'días'} de racha
            </Text>
            <Text style={[styles.detail, { color: colors.textMuted }]}>
              Mejor racha: {streak?.best ?? 0}
            </Text>
          </View>
        </View>
      ) : null}

      <Section title="Contadores en común">
        {counters.isPending ? (
          <Text style={[styles.detail, { color: colors.textMuted }]}>Cargando…</Text>
        ) : commonCounters.length === 0 ? (
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            No compartís ningún contador. Los contadores en común son los de vuestros grupos.
          </Text>
        ) : (
          commonCounters.map((c) => (
            <CounterRow key={c.id} counter={c} theirName={person.display_name} />
          ))
        )}
      </Section>
      {commonCounters.length > 0 ? (
        <Section title={`Tú y ${person.display_name}`}>
          <CommonCountersChart
            counters={commonCounters}
            friendId={id}
            friendName={person.display_name}
          />
        </Section>
      ) : null}

      {isFriend ? (
        <Section title="Sus contadores">
          {publicCounters.length === 0 ? (
            <Text style={[styles.detail, { color: colors.textMuted }]}>
              No tiene contadores visibles para sus amigos.
            </Text>
          ) : (
            <>
              {person.hide_counter_totals ? (
                <Text style={[styles.detail, { color: colors.textMuted }]}>
                  {person.display_name} prefiere no enseñar cuánto lleva.
                </Text>
              ) : null}
              {publicCounters.map((c) => (
                <CounterRow key={c.id} counter={c} />
              ))}
            </>
          )}
        </Section>
      ) : null}

      {isFriend ? (
        <AppButton title="Eliminar amigo" variant="ghost" onPress={confirmRemove} />
      ) : null}
    </ScrollView>
  );
}

function CounterRow({ counter, theirName }: { counter: UserCounter; theirName?: string }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.counter, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <CounterAvatar
        emoji={counter.emoji}
        name={counter.name}
        photoPath={counter.photoPath}
        size={38}
      />
      <View style={styles.flex}>
        <Text style={[styles.counterName, { color: colors.text }]} numberOfLines={1}>
          {counter.name}
        </Text>
        <Text style={[styles.detail, { color: colors.textMuted }]} numberOfLines={1}>
          {counter.groupName ? `👥 ${counter.groupName}` : 'Individual'}
          {counter.myTotal !== null
            ? ` · Tú: ${formatWithUnit(counter.myTotal, counter.unit)}`
            : ''}
        </Text>
      </View>
      <View style={styles.total}>
        {counter.theirTotal === null ? (
          // Oculta sus números a sus amigos: se ve el contador, pero no cuánto lleva.
          <Ionicons
            name="lock-closed"
            size={18}
            color={colors.textMuted}
            accessibilityLabel="Número oculto"
          />
        ) : (
          <Text style={[styles.totalNumber, { color: colors.primary }]} numberOfLines={1}>
            {formatWithUnit(counter.theirTotal, counter.unit)}
          </Text>
        )}
        {theirName ? (
          <Text style={[styles.detail, { color: colors.textMuted }]} numberOfLines={1}>
            {theirName}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20 },
  header: { alignItems: 'center', gap: 4 },
  name: { fontSize: 24, fontFamily: fonts.title, marginTop: 8 },
  detail: { fontSize: 14, fontFamily: fonts.detail },
  center: { textAlign: 'center' },
  row2: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  streakNumber: { fontSize: 20, fontFamily: fonts.title },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  counterName: { fontSize: 16, fontFamily: fonts.title },
  total: { alignItems: 'flex-end', maxWidth: '40%' },
  totalNumber: { fontSize: 16, fontFamily: fonts.title },
});

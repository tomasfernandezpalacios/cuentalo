import { useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { PersonRow } from '@/features/social/components/PersonRow';
import { useFriendships, useGroup, useInviteToGroup } from '@/features/social/hooks';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';

/** Lista de amigos para invitar al grupo. Solo se puede invitar a amigos aceptados. */
export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const group = useGroup(id);
  const friendships = useFriendships();
  const invite = useInviteToGroup(id);

  if (group.isPending || friendships.isPending) return <LoadingView />;
  if (group.isError || friendships.isError) {
    return <ErrorView error={group.error ?? friendships.error} onRetry={friendships.refetch} />;
  }

  const memberStatus = new Map(group.data.members.map((m) => [m.user_id, m.status]));
  const friends = friendships.data.filter((f) => f.status === 'accepted').map((f) => f.other);

  if (friends.length === 0) {
    return (
      <EmptyView
        title="No tienes amigos todavía"
        description="Añade amigos desde la pestaña Amigos y grupos para poder invitarlos."
      />
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <FlatList
        data={friends}
        keyExtractor={(friend) => friend.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Tus amigos recibirán una invitación y entrarán al grupo cuando la acepten.
          </Text>
        }
        renderItem={({ item }) => {
          const status = memberStatus.get(item.id);
          return (
            <PersonRow
              profile={item}
              actions={
                status ? (
                  <Text style={[styles.hint, { color: colors.textMuted }]}>
                    {status === 'active' ? 'Ya es miembro' : 'Invitado'}
                  </Text>
                ) : item.group_invites === 'nobody' ? (
                  // Ha desactivado las invitaciones en Configuración: solo entra con el código.
                  <Text style={[styles.hint, { color: colors.textMuted }]}>Solo con código</Text>
                ) : (
                  <AppButton
                    small
                    title="Invitar"
                    onPress={() =>
                      invite.mutate(item.id, {
                        onError: (error) => appAlert('Error', getErrorMessage(error)),
                      })
                    }
                  />
                )
              }
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16 },
  hint: { fontSize: 14, fontFamily: fonts.detail, marginBottom: 8 },
});

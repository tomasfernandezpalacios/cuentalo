import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Section } from '@/components/Section';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { useUserId } from '@/features/auth/AuthProvider';
import { GroupCounters } from '@/features/contadores/components/GroupCounters';
import { GroupLeaderboard } from '@/features/contadores/components/GroupLeaderboard';
import type { MemberWithProfile } from '@/features/social/api';
import { InviteCodeCard } from '@/features/social/components/InviteCodeCard';
import { PersonRow } from '@/features/social/components/PersonRow';
import { useDeleteGroup, useGroup, useRemoveMember } from '@/features/social/hooks';
import { getErrorMessage } from '@/lib/errors';
import { useThemeColors } from '@/lib/theme';

function showError(error: unknown) {
  Alert.alert('Error', getErrorMessage(error));
}

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const userId = useUserId();
  const group = useGroup(id);
  const removeMember = useRemoveMember();
  const deleteGroup = useDeleteGroup();

  if (group.isPending) return <LoadingView />;
  if (group.isError) return <ErrorView error={group.error} onRetry={group.refetch} />;

  const { name, owner_id, members } = group.data;
  const isOwner = owner_id === userId;
  const active = members.filter((m) => m.status === 'active');
  const invited = members.filter((m) => m.status === 'invited');

  function confirmRemove(member: MemberWithProfile) {
    const pending = member.status === 'invited';
    Alert.alert(
      pending ? 'Retirar invitación' : 'Expulsar del grupo',
      pending
        ? `¿Retirar la invitación a ${member.profile.display_name}?`
        : `¿Expulsar a ${member.profile.display_name} del grupo? Conservará sus estadísticas personales.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: pending ? 'Retirar' : 'Expulsar',
          style: 'destructive',
          onPress: () =>
            removeMember.mutate({ groupId: id, userId: member.user_id }, { onError: showError }),
        },
      ],
    );
  }

  function confirmLeave() {
    Alert.alert('Salir del grupo', `¿Seguro que quieres salir de «${name}»?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: () =>
          removeMember.mutate(
            { groupId: id, userId },
            { onSuccess: () => router.back(), onError: showError },
          ),
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert(
      'Eliminar grupo',
      `Se eliminará «${name}» para todos sus miembros. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () =>
            deleteGroup.mutate(id, { onSuccess: () => router.back(), onError: showError }),
        },
      ],
    );
  }

  function memberActions(member: MemberWithProfile) {
    if (!isOwner || member.role === 'owner') return undefined;
    return (
      <Pressable
        onPress={() => confirmRemove(member)}
        accessibilityRole="button"
        accessibilityLabel={`Quitar a ${member.profile.display_name}`}
        hitSlop={10}
      >
        <Ionicons name="close-circle-outline" size={24} color={colors.textMuted} />
      </Pressable>
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
          refreshing={group.isRefetching}
          onRefresh={() => void group.refetch()}
        />
      }
    >
      <Stack.Screen options={{ title: name }} />

      <Section title="Clasificación">
        <GroupLeaderboard groupId={id} />
      </Section>

      <Section title="Contadores del grupo">
        <GroupCounters groupId={id} />
      </Section>

      {isOwner ? (
        <>
          <InviteCodeCard groupId={id} groupName={name} />
          <AppButton
            title="Invitar a amigos de la app"
            variant="secondary"
            onPress={() => router.push({ pathname: '/grupos/[id]/invitar', params: { id } })}
          />
        </>
      ) : null}

      <Section title={`Miembros (${active.length})`}>
        <View>
          {active.map((m) => (
            <PersonRow
              key={m.user_id}
              profile={m.profile}
              note={m.role === 'owner' ? 'Administrador' : m.user_id === userId ? 'Tú' : undefined}
              actions={memberActions(m)}
            />
          ))}
        </View>
      </Section>

      {invited.length > 0 ? (
        <Section title="Invitaciones pendientes">
          <View>
            {invited.map((m) => (
              <PersonRow
                key={m.user_id}
                profile={m.profile}
                note="Invitado"
                actions={memberActions(m)}
              />
            ))}
          </View>
        </Section>
      ) : null}

      <View style={styles.danger}>
        {isOwner ? (
          <AppButton
            title="Eliminar grupo"
            variant="danger"
            onPress={confirmDelete}
            loading={deleteGroup.isPending}
          />
        ) : (
          <AppButton title="Salir del grupo" variant="secondary" onPress={confirmLeave} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24 },
  danger: { marginTop: 8 },
});

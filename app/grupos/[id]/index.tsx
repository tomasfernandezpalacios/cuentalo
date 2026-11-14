import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { usePullRefresh } from '@/lib/usePullRefresh';
import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { Section } from '@/components/Section';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { useUserId } from '@/features/auth/AuthProvider';
import { GroupCounters } from '@/features/contadores/components/GroupCounters';
import { GroupLeaderboard } from '@/features/contadores/components/GroupLeaderboard';
import type { MemberWithProfile } from '@/features/social/api';
import { GroupHeaderCard } from '@/features/social/components/GroupHeaderCard';
import { PersonRow } from '@/features/social/components/PersonRow';
import {
  useDeleteGroup,
  useFriendships,
  useGroup,
  useLeaveGroup,
  useRemoveMember,
  useResignGroupAdmin,
  useRespondFriendRequest,
  useSendFriendRequest,
} from '@/features/social/hooks';
import { getErrorMessage } from '@/lib/errors';
import { useThemeColors } from '@/lib/theme';

function showError(error: unknown) {
  appAlert('Error', getErrorMessage(error));
}

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const userId = useUserId();
  const group = useGroup(id);
  const pull = usePullRefresh(() => group.refetch());
  const removeMember = useRemoveMember();
  const deleteGroup = useDeleteGroup();
  const leaveGroup = useLeaveGroup();
  const friendships = useFriendships();
  const sendRequest = useSendFriendRequest();
  const respondRequest = useRespondFriendRequest();
  const resign = useResignGroupAdmin();

  if (group.isPending) return <LoadingView />;
  if (group.isError) return <ErrorView error={group.error} onRetry={group.refetch} />;

  const { name, owner_id, members } = group.data;
  const isOwner = owner_id === userId;
  const active = members.filter((m) => m.status === 'active');
  const invited = members.filter((m) => m.status === 'invited');

  function confirmRemove(member: MemberWithProfile) {
    const pending = member.status === 'invited';
    appAlert(
      pending ? 'Retirar invitación' : 'Expulsar del grupo',
      pending
        ? `¿Retirar la invitación a ${member.profile.display_name}?`
        : `¿Expulsar a ${member.profile.display_name} del grupo? Conservará sus estadísticas personales y el grupo estrenará código de invitación.`,
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

  const othersActive = active.filter((m) => m.user_id !== userId).length;

  function leave() {
    leaveGroup.mutate(id, { onSuccess: () => router.back(), onError: showError });
  }

  function confirmLeave() {
    if (isOwner && othersActive === 0) {
      appAlert(
        'Eres el único miembro',
        'No hay nadie a quien pasarle el liderazgo. Si quieres irte, elimina el grupo.',
      );
      return;
    }
    appAlert(
      'Abandonar el grupo',
      isOwner
        ? `Eres el líder de «${name}». Si sales ahora, el liderazgo pasará a un ` +
            'miembro elegido al azar. Si prefieres elegir tú, designa antes a alguien con el ' +
            'escudo junto a su nombre.\n\nConservarás tus estadísticas personales.'
        : `¿Seguro que quieres salir de «${name}»? Conservarás tus estadísticas personales.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abandonar', style: 'destructive', onPress: leave },
      ],
    );
  }

  function confirmResign() {
    if (othersActive === 0) {
      appAlert('Eres el único miembro', 'No hay nadie a quien pasarle el liderazgo del grupo.');
      return;
    }
    appAlert(
      'Dejar de ser líder',
      'Te recomendamos designar tú a alguien antes: toca el escudo junto al nombre de otro ' +
        'miembro. Si te retiras sin hacerlo, el liderazgo pasará a un miembro elegido al ' +
        'azar.\n\nSeguirás en el grupo como un miembro más.',
      [
        { text: 'Designar a alguien', style: 'cancel' },
        {
          text: 'Retirarme igualmente',
          style: 'destructive',
          onPress: () =>
            resign.mutate(id, {
              onSuccess: () =>
                appAlert('Ya no eres líder', 'El liderazgo ha pasado a otro miembro.'),
              onError: showError,
            }),
        },
      ],
    );
  }

  function confirmDelete() {
    appAlert(
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

  /**
   * Icono de amistad junto a cada miembro que no es mi amigo: persona con + para enviarle una
   * solicitud (o aceptar la suya), o un reloj si ya se la he enviado. Lo ve todo el mundo.
   */
  function friendAction(member: MemberWithProfile) {
    if (member.user_id === userId || !friendships.data) return null;
    const friendship = friendships.data.find((f) => f.other.id === member.user_id);
    const personName = member.profile.display_name;
    if (friendship?.status === 'accepted') return null;
    // Me la envió (pendiente, o rechazada por mí antes): tocar la acepta.
    if (friendship && friendship.direction === 'incoming') {
      return (
        <Pressable
          key="friend"
          onPress={() =>
            respondRequest.mutate(
              { id: friendship.id, status: 'accepted' },
              {
                onSuccess: () => appAlert('Ahora sois amigos', `${personName} ya es tu amigo.`),
                onError: showError,
              },
            )
          }
          accessibilityRole="button"
          accessibilityLabel={`Aceptar la solicitud de amistad de ${personName}`}
          hitSlop={10}
        >
          <Ionicons name="person-add" size={22} color={colors.primary} />
        </Pressable>
      );
    }
    if (friendship) {
      // Solicitud mía pendiente (o rechazada, que no se comunica): solo se indica.
      return (
        <View
          key="friend"
          accessible
          accessibilityLabel={`Solicitud de amistad enviada a ${personName}`}
        >
          <Ionicons name="time-outline" size={22} color={colors.textMuted} />
        </View>
      );
    }
    return (
      <Pressable
        key="friend"
        onPress={() =>
          sendRequest.mutate(member.user_id, {
            onSuccess: () => appAlert('Solicitud enviada', `${personName} la verá en su buzón.`),
            onError: showError,
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Enviar solicitud de amistad a ${personName}`}
        hitSlop={10}
      >
        <Ionicons name="person-add-outline" size={22} color={colors.textMuted} />
      </Pressable>
    );
  }

  function memberActions(member: MemberWithProfile) {
    const friend = friendAction(member);
    const admin = adminActions(member);
    if (!friend && !admin) return undefined;
    return (
      <View style={styles.actions}>
        {friend}
        {admin}
      </View>
    );
  }

  function adminActions(member: MemberWithProfile) {
    if (!isOwner) return null;
    // Mi propia fila: dejar de ser líder.
    if (member.user_id === userId) {
      return (
        <Pressable
          onPress={confirmResign}
          accessibilityRole="button"
          accessibilityLabel="Dejar de ser líder"
          hitSlop={10}
        >
          <Ionicons name="shield-half-outline" size={24} color={colors.textMuted} />
        </Pressable>
      );
    }
    return (
      <>
        {member.status === 'active' ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/grupos/[id]/administrador',
                params: { id, usuario: member.user_id },
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`Hacer líder a ${member.profile.display_name}`}
            hitSlop={10}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => confirmRemove(member)}
          accessibilityRole="button"
          accessibilityLabel={`Quitar a ${member.profile.display_name}`}
          hitSlop={10}
        >
          <Ionicons name="close-circle-outline" size={24} color={colors.textMuted} />
        </Pressable>
      </>
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
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
        />
      }
    >
      <Stack.Screen
        options={{
          title: name,
          headerRight: () => (
            // collapsable={false}: en Android, sin él los botones de la cabecera nativa pueden
            // no recibir toques.
            <View collapsable={false} style={styles.headerActions}>
              {isOwner ? (
                <Pressable
                  onPress={() => router.push({ pathname: '/grupos/[id]/editar', params: { id } })}
                  accessibilityRole="button"
                  accessibilityLabel="Editar grupo"
                  hitSlop={12}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                >
                  <Ionicons name="create-outline" size={24} color={colors.primary} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/contadores/nuevo', params: { grupo: id } })
                }
                accessibilityRole="button"
                accessibilityLabel="Nuevo contador compartido"
                hitSlop={6}
                style={({ pressed }) => [
                  styles.addButton,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons name="add" size={26} color={colors.background} />
              </Pressable>
            </View>
          ),
        }}
      />

      {/* Imagen y nombre del grupo y, para los miembros activos, el código para unirse. */}
      <GroupHeaderCard
        groupId={id}
        groupName={name}
        emoji={group.data.emoji}
        photoPath={group.data.photo_path}
        showCode={active.some((m) => m.user_id === userId)}
      />

      <Section title="Clasificación">
        <GroupLeaderboard groupId={id} />
      </Section>

      <Section title="Contadores del grupo">
        <GroupCounters groupId={id} />
      </Section>

      <Section title={`Miembros (${active.length})`}>
        <View>
          {active.map((m) => (
            <PersonRow
              key={m.user_id}
              profile={m.profile}
              note={
                m.role === 'owner'
                  ? m.user_id === userId
                    ? 'Tú · Líder'
                    : 'Líder'
                  : m.user_id === userId
                    ? 'Tú'
                    : undefined
              }
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
            title="Invitar a amigos de la app"
            variant="secondary"
            onPress={() => router.push({ pathname: '/grupos/[id]/invitar', params: { id } })}
          />
        ) : null}
        <AppButton
          title="Abandonar el grupo"
          variant="secondary"
          onPress={confirmLeave}
          loading={leaveGroup.isPending}
        />
        {isOwner ? (
          <AppButton
            title="Eliminar grupo"
            variant="danger"
            onPress={confirmDelete}
            loading={deleteGroup.isPending}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24 },
  danger: { marginTop: 8, gap: 10 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});

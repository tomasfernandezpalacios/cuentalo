import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { Section } from '@/components/Section';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { useUserId } from '@/features/auth/AuthProvider';
import { GroupCounters } from '@/features/contadores/components/GroupCounters';
import { GroupLeaderboard } from '@/features/contadores/components/GroupLeaderboard';
import type { MemberWithProfile } from '@/features/social/api';
import { GroupAvatar } from '@/features/social/components/GroupAvatar';
import { InviteCodeCard } from '@/features/social/components/InviteCodeCard';
import { PersonRow } from '@/features/social/components/PersonRow';
import {
  useDeleteGroup,
  useGroup,
  useLeaveGroup,
  useRemoveMember,
  useResignGroupAdmin,
} from '@/features/social/hooks';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';

function showError(error: unknown) {
  appAlert('Error', getErrorMessage(error));
}

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const userId = useUserId();
  const group = useGroup(id);
  const removeMember = useRemoveMember();
  const deleteGroup = useDeleteGroup();
  const leaveGroup = useLeaveGroup();
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

  const othersActive = active.filter((m) => m.user_id !== userId).length;

  function leave() {
    leaveGroup.mutate(id, { onSuccess: () => router.back(), onError: showError });
  }

  function confirmLeave() {
    if (isOwner && othersActive === 0) {
      appAlert(
        'Eres el único miembro',
        'No hay nadie a quien pasarle la administración. Si quieres irte, elimina el grupo.',
      );
      return;
    }
    appAlert(
      'Abandonar el grupo',
      isOwner
        ? `Eres el administrador de «${name}». Si sales ahora, la administración pasará a un ` +
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
      appAlert(
        'Eres el único miembro',
        'No hay nadie a quien pasarle la administración del grupo.',
      );
      return;
    }
    appAlert(
      'Dejar de ser administrador',
      'Te recomendamos designar tú a alguien antes: toca el escudo junto al nombre de otro ' +
        'miembro. Si te retiras sin hacerlo, la administración pasará a un miembro elegido al ' +
        'azar.\n\nSeguirás en el grupo como un miembro más.',
      [
        { text: 'Designar a alguien', style: 'cancel' },
        {
          text: 'Retirarme igualmente',
          style: 'destructive',
          onPress: () =>
            resign.mutate(id, {
              onSuccess: () =>
                appAlert('Ya no eres administrador', 'La administración ha pasado a otro miembro.'),
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

  function memberActions(member: MemberWithProfile) {
    if (!isOwner) return undefined;
    // Mi propia fila: retirarme como administrador.
    if (member.user_id === userId) {
      return (
        <Pressable
          onPress={confirmResign}
          accessibilityRole="button"
          accessibilityLabel="Dejar de ser administrador"
          hitSlop={10}
        >
          <Ionicons name="shield-half-outline" size={24} color={colors.textMuted} />
        </Pressable>
      );
    }
    return (
      <View style={styles.actions}>
        {member.status === 'active' ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/grupos/[id]/administrador',
                params: { id, usuario: member.user_id },
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`Hacer administrador a ${member.profile.display_name}`}
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
      </View>
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
                <Ionicons name="add" size={26} color="#000000" />
              </Pressable>
            </View>
          ),
        }}
      />

      {/* Imagen y nombre a la izquierda; el código para unirse (solo el admin) a la derecha. */}
      <View style={styles.top}>
        <View style={styles.hero}>
          <GroupAvatar emoji={group.data.emoji} photoPath={group.data.photo_path} size={88} />
          <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={3}>
            {name}
          </Text>
        </View>
        {isOwner ? (
          <View style={styles.flex}>
            <InviteCodeCard groupId={id} groupName={name} compact />
          </View>
        ) : null}
      </View>

      <Section title="Clasificación">
        <GroupLeaderboard groupId={id} />
      </Section>

      <Section title="Contadores del grupo">
        <GroupCounters groupId={id} />
      </Section>

      {isOwner ? (
        <AppButton
          title="Invitar a amigos de la app"
          variant="secondary"
          onPress={() => router.push({ pathname: '/grupos/[id]/invitar', params: { id } })}
        />
      ) : null}

      <Section title={`Miembros (${active.length})`}>
        <View>
          {active.map((m) => (
            <PersonRow
              key={m.user_id}
              profile={m.profile}
              note={
                m.role === 'owner'
                  ? m.user_id === userId
                    ? 'Tú · Administrador'
                    : 'Administrador'
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
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  hero: { alignItems: 'center', gap: 8, width: 112 },
  flex: { flex: 1 },
  heroName: { fontSize: 18, fontFamily: fonts.title, textAlign: 'center' },
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

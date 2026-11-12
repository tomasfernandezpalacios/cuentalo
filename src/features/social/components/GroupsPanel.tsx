import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { Section } from '@/components/Section';
import { TextField } from '@/components/TextField';
import { ErrorView } from '@/components/StateViews';
import { useUserId } from '@/features/auth/AuthProvider';
import { getErrorMessage } from '@/lib/errors';
import { fonts, shape, useThemeColors } from '@/lib/theme';

import { useCounterList } from '@/features/contadores/hooks';
import { useMyDailyTotals } from '@/features/estadisticas/api';

import { fetchGroup, fetchInviteCode, normalizeInviteCode, type MyGroup } from '../api';
import { GroupAvatar } from './GroupAvatar';
import { GroupHeaderCard, shareInvite } from './GroupHeaderCard';
import { socialKeys, useAcceptInvitation, useMyGroups, useRemoveMember } from '../hooks';

function showError(error: unknown) {
  appAlert('Error', getErrorMessage(error));
}

/**
 * Último día en que **yo** registré algo en cada grupo (en cualquiera de sus contadores), para
 * ordenar «Tus grupos» por mi actividad: cada usuario ve su propio orden. Sale de datos que ya
 * están cargados (mis totales diarios y la lista de contadores), sin pedir nada más.
 */
function useMyLastActivityByGroup(): Map<string, string> {
  const counters = useCounterList();
  const daily = useMyDailyTotals(useUserId());
  const groupOf = new Map(
    (counters.data ?? []).filter((c) => c.group_id).map((c) => [c.id, c.group_id as string]),
  );
  const last = new Map<string, string>();
  for (const row of daily.data ?? []) {
    const groupId = groupOf.get(row.counterId);
    if (!groupId) continue;
    const previous = last.get(groupId);
    if (!previous || row.day > previous) last.set(groupId, row.day);
  }
  return last;
}

export function GroupsPanel() {
  const colors = useThemeColors();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const groups = useMyGroups();
  const accept = useAcceptInvitation();
  const decline = useRemoveMember();
  const lastActivity = useMyLastActivityByGroup();

  const all = groups.data ?? [];
  const invitations = all.filter((g) => g.status === 'invited');
  // Primero los grupos donde he registrado algo más recientemente; después, los demás.
  const mine = all
    .filter((g) => g.status === 'active')
    .map((g, index) => ({ g, index, last: lastActivity.get(g.id) ?? '' }))
    .sort((a, b) => (a.last === b.last ? a.index - b.index : a.last < b.last ? 1 : -1))
    .map(({ g }) => g);

  // Cada grupo se carga por detrás: al tocarlo se abre al instante, sin «cargando».
  const mineIds = mine.map((g) => g.id).join(',');
  useEffect(() => {
    for (const id of mineIds.split(',').filter(Boolean)) {
      void queryClient.prefetchQuery({
        queryKey: socialKeys.group(id),
        queryFn: () => fetchGroup(id),
      });
    }
  }, [mineIds, queryClient]);

  if (groups.isError) return <ErrorView error={groups.error} onRetry={groups.refetch} />;

  /** Mantener pulsado un grupo: acciones rápidas sin entrar. */
  function groupMenu(group: MyGroup) {
    appAlert(group.name, undefined, [
      {
        text: 'Abrir el grupo',
        onPress: () => router.push({ pathname: '/grupos/[id]', params: { id: group.id } }),
      },
      {
        text: 'Nuevo contador del grupo',
        onPress: () => router.push({ pathname: '/contadores/nuevo', params: { grupo: group.id } }),
      },
      {
        text: 'Compartir invitación',
        onPress: () =>
          queryClient
            .fetchQuery({
              queryKey: socialKeys.inviteCode(group.id),
              queryFn: () => fetchInviteCode(group.id),
            })
            .then((code) => shareInvite(group.name, code))
            .catch(showError),
      },
      { text: 'Cerrar', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.container}>
      {invitations.length > 0 ? (
        <Section title="Invitaciones">
          {invitations.map((group) => (
            <View
              key={group.id}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
              <Text style={[styles.detail, { color: colors.textMuted }]}>
                Te han invitado a este grupo.
              </Text>
              <View style={styles.actions}>
                <AppButton
                  small
                  title="Unirme"
                  onPress={() => accept.mutate(group.id, { onError: showError })}
                  style={styles.flex}
                />
                <AppButton
                  small
                  variant="secondary"
                  title="Rechazar"
                  onPress={() =>
                    decline.mutate({ groupId: group.id, userId }, { onError: showError })
                  }
                  style={styles.flex}
                />
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      <Section title="Tus grupos">
        {groups.isPending ? (
          <ActivityIndicator color={colors.primary} />
        ) : mine.length === 0 ? (
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            Aún no estás en ningún grupo. Crea uno con el + de arriba o únete con un código (la
            llave).
          </Text>
        ) : (
          // Bloques grandes, los mismos de la cabecera del grupo (con el código para unirse).
          mine.map((group) => (
            <GroupHeaderCard
              key={group.id}
              groupId={group.id}
              groupName={group.name}
              emoji={group.emoji}
              photoPath={group.photo_path}
              showCode
              onPress={() => router.push({ pathname: '/grupos/[id]', params: { id: group.id } })}
              onLongPress={() => groupMenu(group)}
            />
          ))
        )}
      </Section>
    </View>
  );
}

/** Campo para escribir un código de invitación; abre la vista previa del grupo. */
export function JoinByCode() {
  const [code, setCode] = useState('');
  const normalized = normalizeInviteCode(code);

  function submit() {
    if (normalized.length === 0) return;
    router.push({ pathname: '/unirse/[code]', params: { code: normalized } });
    setCode('');
  }

  return (
    <View style={styles.joinRow}>
      <View style={styles.flex}>
        <TextField
          label="¿Tienes un código?"
          value={code}
          onChangeText={setCode}
          placeholder="ABCD-EFGH"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          onSubmitEditing={submit}
          style={styles.codeInput}
        />
      </View>
      <AppButton
        title="Unirme"
        onPress={submit}
        disabled={normalized.length < 8}
        style={styles.joinButton}
      />
    </View>
  );
}

export function GroupRow({ group }: { group: MyGroup }) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/grupos/[id]', params: { id: group.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Grupo ${group.name}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <GroupAvatar emoji={group.emoji} photoPath={group.photo_path} size={40} />
      <View style={styles.flex}>
        <Text style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>
          {group.name}
        </Text>
        {group.role === 'owner' ? (
          <Text style={[styles.detail, { color: colors.textMuted }]}>Eres el líder</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 24 },
  card: { padding: 14, borderRadius: shape.card, borderWidth: 1, gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  groupName: { fontSize: 17, fontFamily: fonts.title },
  detail: { fontSize: 14, fontFamily: fonts.detail },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  flex: { flex: 1 },
  joinRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  joinButton: { minWidth: 96 },
  codeInput: { letterSpacing: 2, fontFamily: fonts.title },
});

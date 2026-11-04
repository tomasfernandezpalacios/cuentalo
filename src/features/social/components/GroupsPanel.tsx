import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Section } from '@/components/Section';
import { TextField } from '@/components/TextField';
import { ErrorView } from '@/components/StateViews';
import { useUserId } from '@/features/auth/AuthProvider';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';

import { normalizeInviteCode, type MyGroup } from '../api';
import { GroupAvatar } from './GroupAvatar';
import { useAcceptInvitation, useMyGroups, useRemoveMember } from '../hooks';

function showError(error: unknown) {
  Alert.alert('Error', getErrorMessage(error));
}

export function GroupsPanel() {
  const colors = useThemeColors();
  const userId = useUserId();
  const groups = useMyGroups();
  const accept = useAcceptInvitation();
  const decline = useRemoveMember();

  if (groups.isError) return <ErrorView error={groups.error} onRetry={groups.refetch} />;

  const all = groups.data ?? [];
  const invitations = all.filter((g) => g.status === 'invited');
  const mine = all.filter((g) => g.status === 'active');

  return (
    <View style={styles.container}>
      <AppButton title="Crear grupo" onPress={() => router.push('/grupos/nuevo')} />
      <JoinByCode />

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
            Aún no estás en ningún grupo. Crea uno e invita a tus amigos.
          </Text>
        ) : (
          mine.map((group) => <GroupRow key={group.id} group={group} />)
        )}
      </Section>
    </View>
  );
}

/** Campo para escribir un código de invitación; abre la vista previa del grupo. */
function JoinByCode() {
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
          <Text style={[styles.detail, { color: colors.textMuted }]}>Eres el administrador</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 24 },
  card: { padding: 14, borderRadius: 16, borderWidth: 1, gap: 6 },
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

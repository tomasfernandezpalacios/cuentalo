import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Section } from '@/components/Section';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { signOut } from '@/features/auth/api';
import { useAuth, useUserId } from '@/features/auth/AuthProvider';
import { CounterAvatar } from '@/features/contadores/components/CounterAvatar';
import { useDeleteAccount, useProfile } from '@/features/perfil/api';
import { GroupRow } from '@/features/social/components/GroupsPanel';
import { useMyGroups } from '@/features/social/hooks';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';

export default function ProfileScreen() {
  const colors = useThemeColors();
  const { session } = useAuth();
  const profile = useProfile(useUserId());
  const groups = useMyGroups();
  const logout = useMutation({
    mutationFn: signOut,
    onError: (error) => Alert.alert('Error', getErrorMessage(error)),
  });
  const deleteAccount = useDeleteAccount();

  if (profile.isPending) return <LoadingView />;
  if (profile.isError) return <ErrorView error={profile.error} onRetry={profile.refetch} />;

  const myGroups = (groups.data ?? []).filter((g) => g.status === 'active');
  const ownedGroups = myGroups.filter((g) => g.role === 'owner').length;

  function confirmDelete() {
    Alert.alert(
      'Eliminar cuenta',
      'Se borrarán para siempre tu perfil, tus contadores privados, todos tus registros y tus ' +
        'amistades. ' +
        (ownedGroups > 0
          ? 'Los grupos que administras pasarán a otro miembro (o se borrarán si estás solo). '
          : '') +
        'Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          // Segunda confirmación: es irreversible.
          onPress: () =>
            Alert.alert('¿Seguro?', 'Tu cuenta se eliminará ahora mismo.', [
              { text: 'No, mantenerla', style: 'cancel' },
              {
                text: 'Eliminar mi cuenta',
                style: 'destructive',
                onPress: () =>
                  deleteAccount.mutate(undefined, {
                    onError: (error) => Alert.alert('Error', getErrorMessage(error)),
                  }),
              },
            ]),
        },
      ],
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
          refreshing={profile.isRefetching}
          onRefresh={() => {
            profile.refetch();
            groups.refetch();
          }}
        />
      }
    >
      <View style={styles.header} accessible>
        <CounterAvatar emoji={null} name={profile.data.display_name} size={88} />
        <Text style={[styles.name, { color: colors.text }]}>{profile.data.display_name}</Text>
        <Text style={[styles.detail, { color: colors.textMuted }]}>@{profile.data.username}</Text>
        {session?.user.email ? (
          <Text style={[styles.detail, { color: colors.textMuted }]}>{session.user.email}</Text>
        ) : null}
      </View>

      <AppButton
        title="Editar perfil"
        variant="secondary"
        onPress={() => router.push('/perfil/editar')}
      />

      <Section title="Tus grupos">
        {myGroups.length === 0 ? (
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            Aún no estás en ningún grupo.
          </Text>
        ) : (
          myGroups.map((group) => <GroupRow key={group.id} group={group} />)
        )}
      </Section>

      <Section title="Cuenta">
        <AppButton
          title="Cerrar sesión"
          variant="secondary"
          onPress={() => logout.mutate()}
          loading={logout.isPending}
        />
        <AppButton
          title="Eliminar cuenta"
          variant="ghost"
          onPress={confirmDelete}
          loading={deleteAccount.isPending}
          accessibilityLabel="Eliminar cuenta y todos mis datos"
        />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 24 },
  header: { alignItems: 'center', gap: 4, marginTop: 8 },
  name: { fontSize: 26, fontFamily: fonts.title, marginTop: 8 },
  detail: { fontSize: 15, fontFamily: fonts.detail },
});

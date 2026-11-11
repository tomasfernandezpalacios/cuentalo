import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Section } from '@/components/Section';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { useAuth, useUserId } from '@/features/auth/AuthProvider';
import { StreakCard } from '@/features/estadisticas/components/StreakCard';
import { useProfile } from '@/features/perfil/api';
import { GroupRow } from '@/features/social/components/GroupsPanel';
import { useMyGroups } from '@/features/social/hooks';
import { PersonAvatar } from '@/features/perfil/PersonAvatar';
import { displayFont, fonts, useThemeColors } from '@/lib/theme';

export default function ProfileScreen() {
  const colors = useThemeColors();
  const { session } = useAuth();
  const profile = useProfile(useUserId());
  const groups = useMyGroups();

  if (profile.isPending) return <LoadingView />;
  if (profile.isError) return <ErrorView error={profile.error} onRetry={profile.refetch} />;

  const myGroups = (groups.data ?? []).filter((g) => g.status === 'active');

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
        <PersonAvatar
          name={profile.data.display_name}
          emoji={profile.data.emoji}
          photoPath={profile.data.photo_path}
          size={96}
        />
        <Text style={[styles.name, { color: colors.text }]}>{profile.data.display_name}</Text>
        <Text style={[styles.detail, { color: colors.textMuted }]}>@{profile.data.username}</Text>
        {session?.user.email ? (
          <Text style={[styles.detail, { color: colors.textMuted }]}>{session.user.email}</Text>
        ) : null}
      </View>

      {/* Mi racha de uso, como la ven mis amigos en mi perfil (lleva al calendario). */}
      <StreakCard onPress={() => router.push('/racha')} />

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 24 },
  header: { alignItems: 'center', gap: 4, marginTop: 8 },
  name: { ...displayFont(26), marginTop: 8 },
  detail: { fontSize: 15, fontFamily: fonts.detail },
});

import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { usePullRefresh } from '@/lib/usePullRefresh';
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
  const pull = usePullRefresh(() => Promise.all([profile.refetch(), groups.refetch()]));

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
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
        />
      }
    >
      <View style={styles.header} accessible>
        {/* Banda del color de destaque (el 10 % del tema) que pasa de borde a borde por detrás
            de la foto (petición del usuario). */}
        <View style={styles.avatarArea}>
          <View style={[styles.banner, { backgroundColor: colors.primary }]} />
          <View style={[styles.avatarRing, { borderColor: colors.background }]}>
            <PersonAvatar
              name={profile.data.display_name}
              emoji={profile.data.emoji}
              photoPath={profile.data.photo_path}
              size={96}
            />
          </View>
        </View>
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
  // De borde a borde (el contenido tiene 20 de margen a cada lado).
  avatarArea: { alignSelf: 'stretch', alignItems: 'center', marginHorizontal: -20 },
  // El triple de gruesa que al principio (petición del usuario), centrada con la foto.
  banner: { position: 'absolute', left: 0, right: 0, top: -8, height: 120 },
  avatarRing: { borderWidth: 4, borderRadius: 999 },
  name: { ...displayFont(26), marginTop: 8 },
  detail: { fontSize: 15, fontFamily: fonts.detail },
});

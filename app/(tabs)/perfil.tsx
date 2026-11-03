import { useMutation } from '@tanstack/react-query';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { signOut } from '@/features/auth/api';
import { useUserId } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/perfil/api';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';

// Versión mínima: la pantalla completa de perfil llega en la Fase 5.
export default function ProfileScreen() {
  const colors = useThemeColors();
  const profile = useProfile(useUserId());
  const logout = useMutation({
    mutationFn: signOut,
    onError: (error) => Alert.alert('Error', getErrorMessage(error)),
  });

  if (profile.isPending) return <LoadingView />;
  if (profile.error) return <ErrorView error={profile.error} onRetry={profile.refetch} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]}>{profile.data.display_name}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 16, fontFamily: fonts.detail }}>
          @{profile.data.username}
        </Text>
      </View>
      <AppButton
        title="Cerrar sesión"
        variant="secondary"
        onPress={() => logout.mutate()}
        loading={logout.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 24 },
  info: { alignItems: 'center', gap: 4, marginTop: 24 },
  name: { fontSize: 24, fontFamily: fonts.title },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { useUserId } from '@/features/auth/AuthProvider';
import { PersonAvatar } from '@/features/perfil/PersonAvatar';
import { useGroup, useTransferGroupAdmin } from '@/features/social/hooks';
import { getErrorMessage } from '@/lib/errors';
import { proseFont, titleFont, useThemeColors } from '@/lib/theme';

/** Confirmación para hacer líder del grupo a otro miembro (?usuario=id). */
export default function TransferAdminScreen() {
  const { id, usuario } = useLocalSearchParams<{ id: string; usuario: string }>();
  const colors = useThemeColors();
  const myId = useUserId();
  const group = useGroup(id);
  const transfer = useTransferGroupAdmin();

  if (group.isPending) return <LoadingView />;
  if (group.isError) return <ErrorView error={group.error} onRetry={group.refetch} />;

  const me = group.data.members.find((m) => m.user_id === myId);
  const target = group.data.members.find((m) => m.user_id === usuario && m.status === 'active');
  if (!me || !target || group.data.owner_id !== myId) {
    return (
      <ErrorView
        error={new Error('Solo el líder puede designar a otro miembro activo del grupo.')}
        onRetry={() => router.back()}
      />
    );
  }

  const name = target.profile.display_name;

  function confirm() {
    transfer.mutate(
      { groupId: id, userId: usuario },
      {
        onSuccess: () => {
          router.back();
          appAlert('Líder cambiado', `${name} es ahora el líder del grupo.`);
        },
        onError: (error) => appAlert('No se ha podido cambiar', getErrorMessage(error)),
      },
    );
  }

  const points = [
    `${name} podrá invitar y expulsar, ver el código, editar el grupo y eliminarlo.`,
    'Tú pasarás a ser un miembro más: seguirás en el grupo con tus contadores y registros.',
    'Sigues siendo el administrador de los contadores que creaste.',
    `Solo ${name} podrá volver a hacerte líder.`,
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.people} accessible accessibilityLabel={`De ti a ${name}`}>
        <PersonAvatar
          name={me.profile.display_name}
          emoji={me.profile.emoji}
          photoPath={me.profile.photo_path}
          size={72}
        />
        <Ionicons name="arrow-forward" size={28} color={colors.textMuted} />
        <PersonAvatar
          name={name}
          emoji={target.profile.emoji}
          photoPath={target.profile.photo_path}
          size={72}
        />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        ¿Hacer a {name} líder de «{group.data.name}»?
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {points.map((point) => (
          <View key={point} style={styles.point}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={[styles.detail, { color: colors.text }]}>{point}</Text>
          </View>
        ))}
      </View>

      <AppButton title={`Hacer líder a ${name}`} onPress={confirm} loading={transfer.isPending} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20 },
  people: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { ...titleFont(22), textAlign: 'center' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  detail: { ...proseFont(15, 21), flex: 1 },
});

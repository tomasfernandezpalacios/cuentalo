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
import { fonts, useThemeColors } from '@/lib/theme';

/** Confirmación para pasar la administración del grupo a otro miembro (?usuario=id). */
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
        error={new Error('Solo el administrador puede designar a un miembro activo del grupo.')}
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
          appAlert('Administrador cambiado', `${name} es ahora el administrador del grupo.`);
        },
        onError: (error) => appAlert('No se ha podido cambiar', getErrorMessage(error)),
      },
    );
  }

  const points = [
    `${name} podrá invitar y expulsar, ver y cambiar el código, editar el grupo y eliminarlo.`,
    'Tú pasarás a ser un miembro más: seguirás en el grupo con tus contadores y registros.',
    'Los contadores que creaste los sigues administrando tú.',
    `Solo ${name} podrá devolverte la administración.`,
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
        ¿Hacer a {name} administrador de «{group.data.name}»?
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {points.map((point) => (
          <View key={point} style={styles.point}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={[styles.detail, { color: colors.text }]}>{point}</Text>
          </View>
        ))}
      </View>

      <AppButton
        title={`Hacer administrador a ${name}`}
        onPress={confirm}
        loading={transfer.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20 },
  people: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { fontSize: 22, fontFamily: fonts.title, textAlign: 'center' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  detail: { flex: 1, fontSize: 15, fontFamily: fonts.detail, lineHeight: 21 },
});

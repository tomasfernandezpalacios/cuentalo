import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { PersonAvatar } from '@/features/perfil/PersonAvatar';
import { useMyBlocks, useUnblockUser } from '@/features/social/moderation';
import { getErrorMessage } from '@/lib/errors';
import { fonts, proseFont, useThemeColors } from '@/lib/theme';

/** Configuración → Privacidad → «Usuarios bloqueados»: la lista, con «Desbloquear». */
export default function BlockedUsersScreen() {
  const colors = useThemeColors();
  const blocks = useMyBlocks();
  const unblock = useUnblockUser();

  if (blocks.isPending) return <LoadingView />;
  if (blocks.isError) return <ErrorView error={blocks.error} onRetry={blocks.refetch} />;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        Las personas bloqueadas no pueden enviarte solicitudes de amistad ni invitarte a grupos, y
        no salen en tus sugerencias ni en tus búsquedas. No se les avisa.
      </Text>
      {blocks.data.length === 0 ? (
        <Text style={[styles.intro, { color: colors.textMuted }]}>No has bloqueado a nadie.</Text>
      ) : (
        blocks.data.map((person) => (
          <View
            key={person.id}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <PersonAvatar
              name={person.display_name}
              emoji={person.emoji}
              photoPath={person.photo_path}
              size={40}
            />
            <View style={styles.flex}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {person.display_name}
              </Text>
              <Text style={[styles.detail, { color: colors.textMuted }]} numberOfLines={1}>
                @{person.username}
              </Text>
            </View>
            <AppButton
              title="Desbloquear"
              variant="secondary"
              onPress={() =>
                unblock.mutate(person.id, {
                  onError: (error) => appAlert('Error', getErrorMessage(error)),
                })
              }
            />
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  intro: { ...proseFont(15, 22) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  flex: { flex: 1 },
  name: { fontSize: 16, fontFamily: fonts.title },
  detail: { fontSize: 13, fontFamily: fonts.detail },
});

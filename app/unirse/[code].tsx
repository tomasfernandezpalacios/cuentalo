import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { formatInviteCode, normalizeInviteCode } from '@/features/social/api';
import { useGroupPreview, useJoinGroupByCode } from '@/features/social/hooks';
import { getErrorMessage } from '@/lib/errors';
import { pluralize } from '@/lib/format';
import { displayFont, fonts, useThemeColors } from '@/lib/theme';

/** Se abre con el enlace de invitación (cuentalo://unirse/CODIGO) o al escribir un código. */
export default function JoinGroupScreen() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = normalizeInviteCode(params.code ?? '');
  const colors = useThemeColors();
  const preview = useGroupPreview(code);
  const join = useJoinGroupByCode();

  function openGroup(groupId: string) {
    router.replace({ pathname: '/grupos/[id]', params: { id: groupId } });
  }

  if (preview.isPending) return <LoadingView />;
  if (preview.isError) return <ErrorView error={preview.error} onRetry={preview.refetch} />;
  if (!preview.data) {
    return (
      <EmptyView
        title="Código no válido"
        description={`No hay ningún grupo con el código ${formatInviteCode(code)}. Puede que lo hayan cambiado.`}
        actionTitle="Volver"
        onAction={() => router.back()}
      />
    );
  }

  const { groupId, name, memberCount, isMember } = preview.data;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.emoji}>👥</Text>
      <Text style={[styles.title, { color: colors.text }]}>{name}</Text>
      <Text style={[styles.detail, { color: colors.textMuted }]}>
        {pluralize(memberCount, 'miembro', 'miembros')}
      </Text>

      {isMember ? (
        <>
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            Ya formas parte del grupo.
          </Text>
          <AppButton title="Ver grupo" onPress={() => openGroup(groupId)} style={styles.button} />
        </>
      ) : (
        <>
          {join.error ? (
            <Text style={[styles.detail, { color: colors.danger }]}>
              {getErrorMessage(join.error)}
            </Text>
          ) : null}
          <AppButton
            title="Unirme al grupo"
            onPress={() => join.mutate(code, { onSuccess: openGroup })}
            loading={join.isPending}
            style={styles.button}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emoji: { fontSize: 56 },
  title: { ...displayFont(26), textAlign: 'center' },
  detail: { fontSize: 15, fontFamily: fonts.detail, textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: 16 },
});

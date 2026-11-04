import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { type ComponentProps, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';

import { buildInviteLink, formatInviteCode } from '../api';
import { useInviteCode, useRegenerateInviteCode } from '../hooks';

import { GroupAvatar } from './GroupAvatar';

type Props = { groupId: string; groupName: string };

/** Botón cuadrado con icono (columna de la derecha de la tarjeta). */
function IconButton({
  icon,
  label,
  onPress,
  loading = false,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: colors.surface, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons name={icon} size={20} color={colors.primary} />
      )}
    </Pressable>
  );
}

/**
 * Tarjeta de arriba del grupo: imagen y nombre del grupo y, para el administrador, el código
 * para unirse con tres botones de icono apilados (copiar, compartir enlace y código nuevo).
 */
export function GroupHeaderCard({
  groupId,
  groupName,
  emoji,
  photoPath,
  isOwner,
}: Props & { emoji: string | null; photoPath: string | null; isOwner: boolean }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.primarySoft }]}>
      <View style={styles.group}>
        <GroupAvatar emoji={emoji} photoPath={photoPath} size={isOwner ? 64 : 88} />
        <Text
          style={[styles.groupName, { color: colors.text }, !isOwner && styles.groupNameLarge]}
          numberOfLines={3}
        >
          {groupName}
        </Text>
      </View>
      {isOwner ? <InviteCode groupId={groupId} groupName={groupName} /> : null}
    </View>
  );
}

/** Solo para el owner: código del grupo, copiarlo, compartir el enlace y generar uno nuevo. */
function InviteCode({ groupId, groupName }: Props) {
  const colors = useThemeColors();
  const code = useInviteCode(groupId, true);
  const regenerate = useRegenerateInviteCode(groupId);
  const [copied, setCopied] = useState(false);

  // Tras copiar, el icono se convierte en un ✓ durante dos segundos.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy(value: string) {
    await Clipboard.setStringAsync(formatInviteCode(value));
    setCopied(true);
  }

  function share(value: string) {
    const formatted = formatInviteCode(value);
    Share.share({
      message:
        `Únete a «${groupName}» en Cuéntalo: ${buildInviteLink(value)}\n\n` +
        `O escribe el código ${formatted} en Amigos y grupos → Grupos.`,
    });
  }

  function confirmRegenerate() {
    appAlert(
      'Nuevo código',
      'El código y el enlace actuales dejarán de funcionar. Quien ya esté en el grupo sigue dentro.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cambiar código',
          onPress: () =>
            regenerate.mutate(undefined, {
              onError: (error) => appAlert('Error', getErrorMessage(error)),
            }),
        },
      ],
      { warning: true },
    );
  }

  if (code.isPending) {
    return (
      <View style={styles.codeBox}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (code.isError) {
    return (
      <View style={styles.codeBox}>
        <Text style={[styles.label, { color: colors.danger }]}>{getErrorMessage(code.error)}</Text>
      </View>
    );
  }

  const formatted = formatInviteCode(code.data);
  // El código se parte en dos líneas (ABCD / EFGH) para poder ponerlo grande.
  const [first, second] = formatted.split('-');
  return (
    <>
      <View style={styles.codeBox}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Código para unirse</Text>
        <Text
          style={[styles.code, { color: colors.primary }]}
          selectable
          adjustsFontSizeToFit
          numberOfLines={2}
          accessibilityLabel={`Código: ${code.data.split('').join(' ')}`}
        >
          {second ? `${first}\n${second}` : formatted}
        </Text>
      </View>
      <View style={styles.buttons}>
        <IconButton
          icon={copied ? 'checkmark' : 'copy-outline'}
          label={copied ? 'Código copiado' : 'Copiar código'}
          onPress={() => copy(code.data)}
        />
        <IconButton
          icon="share-social-outline"
          label="Compartir enlace"
          onPress={() => share(code.data)}
        />
        <IconButton
          icon="refresh-outline"
          label="Generar un código nuevo"
          onPress={confirmRegenerate}
          loading={regenerate.isPending}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14 },
  group: { alignItems: 'center', gap: 6, width: 88 },
  groupName: { fontSize: 15, fontFamily: fonts.title, textAlign: 'center' },
  groupNameLarge: { fontSize: 20 },
  codeBox: { flex: 1, alignItems: 'center', gap: 2 },
  label: { fontSize: 13, fontFamily: fonts.detail, textAlign: 'center' },
  code: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: fonts.title,
    letterSpacing: 3,
    textAlign: 'center',
  },
  buttons: { gap: 8 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

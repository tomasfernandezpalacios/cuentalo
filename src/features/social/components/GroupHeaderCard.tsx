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

/** Botón rectangular con icono (fila bajo el código). */
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
 * Tarjeta del grupo (cabecera y lista de «Tus grupos»): imagen con el código a su derecha y el
 * nombre debajo, a la izquierda. El código va en una línea (con copiar a su derecha) y dos
 * botones de icono debajo (compartir enlace y código nuevo).
 */
export function GroupHeaderCard({
  groupId,
  groupName,
  emoji,
  photoPath,
  showCode,
  onPress,
}: Props & {
  emoji: string | null;
  photoPath: string | null;
  /** Miembros activos del grupo (no invitados): ven, comparten y cambian el código. */
  showCode: boolean;
  /** En la lista de «Tus grupos»: toda la tarjeta abre el grupo (con una flecha junto al nombre). */
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  const content = (
    <>
      {/* Arriba: la imagen y, a su derecha y a la misma altura, el código (miembros activos). */}
      <View style={styles.top}>
        <GroupAvatar emoji={emoji} photoPath={photoPath} size={104} />
        {showCode ? (
          <View style={styles.side}>
            <InviteCode groupId={groupId} groupName={groupName} />
          </View>
        ) : null}
      </View>
      {/* Debajo, el nombre a la izquierda y a todo lo ancho (un nombre largo no se aprieta). */}
      <View style={styles.nameRow}>
        <Text style={[styles.groupName, { color: colors.text }]} numberOfLines={3}>
          {groupName}
        </Text>
        {onPress ? <Ionicons name="chevron-forward" size={22} color={colors.textMuted} /> : null}
      </View>
    </>
  );

  if (!onPress) {
    return <View style={[styles.card, { backgroundColor: colors.primarySoft }]}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Grupo ${groupName}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.primarySoft, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {content}
    </Pressable>
  );
}

/** Para los miembros activos: código del grupo, copiarlo, compartir el enlace y generar uno nuevo. */
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
  return (
    <View style={styles.codeBox}>
      <Text style={[styles.label, { color: colors.textMuted }]}>Código para unirse</Text>
      {/* En una línea (si no cabe, la letra se reduce sola) y el copiar a su derecha, sin fondo y del color del código. */}
      <View style={styles.codeRow}>
        <Text
          style={[styles.code, { color: colors.primary }]}
          selectable
          adjustsFontSizeToFit
          numberOfLines={1}
          accessibilityLabel={`Código: ${code.data.split('').join(' ')}`}
        >
          {formatted}
        </Text>
        <Pressable
          onPress={() => copy(code.data)}
          accessibilityRole="button"
          accessibilityLabel={copied ? 'Código copiado' : 'Copiar código'}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={24} color={colors.primary} />
        </Pressable>
      </View>
      <View style={styles.buttons}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, borderRadius: 18, padding: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  side: { flex: 1, gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupName: { flex: 1, fontSize: 22, fontFamily: fonts.title },
  codeBox: { alignItems: 'stretch', gap: 6 },
  label: { fontSize: 13, fontFamily: fonts.detail },
  // Misma altura de línea que el código para que el icono quede centrado con él.
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  code: {
    flexShrink: 1,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: fonts.title,
    letterSpacing: 1.5,
  },
  buttons: { flexDirection: 'row', gap: 6, marginTop: 4 },
  iconButton: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

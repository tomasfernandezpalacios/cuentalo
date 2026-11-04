import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';

import { buildInviteLink, formatInviteCode } from '../api';
import { useInviteCode } from '../hooks';

import { GroupAvatar } from './GroupAvatar';

type Props = { groupId: string; groupName: string };

/**
 * Tarjeta del grupo (cabecera y lista de «Tus grupos»): imagen con el código a su derecha y el
 * nombre debajo, a la izquierda. El código va en una línea (con copiar a su derecha) y,
 * debajo y alineado a su izquierda, «Compartir» (el enlace). El código es fijo: no se cambia.
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
      <Pressable
        onPress={() => share(code.data)}
        accessibilityRole="button"
        accessibilityLabel="Compartir enlace del grupo"
        hitSlop={6}
        style={({ pressed }) => [
          styles.shareButton,
          { backgroundColor: colors.surface, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[styles.shareText, { color: colors.primary }]}>Compartir</Text>
        <Ionicons name="share-social-outline" size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, borderRadius: 18, padding: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  // El código y «Compartir» van abajo, a la altura del final de la imagen, y juntos.
  side: { flex: 1, alignSelf: 'stretch', justifyContent: 'flex-end' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupName: { flex: 1, fontSize: 22, fontFamily: fonts.title },
  codeBox: { alignItems: 'stretch', gap: 0 },
  label: { fontSize: 13, fontFamily: fonts.detail, includeFontPadding: false },
  // El icono, centrado con el código: sin el relleno extra que Android pone a las fuentes, el
  // centro de la línea coincide con el de las letras (son todo mayúsculas y números).
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: {
    flexShrink: 1,
    fontSize: 26,
    fontFamily: fonts.title,
    letterSpacing: 1.5,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  // Alineado a la izquierda, con el código.
  shareButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    // Pegado al código.
    marginTop: 2,
  },
  shareText: { fontSize: 15, fontFamily: fonts.title },
});

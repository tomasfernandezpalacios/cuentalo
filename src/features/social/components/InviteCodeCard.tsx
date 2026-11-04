import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';

import { buildInviteLink, formatInviteCode } from '../api';
import { useInviteCode, useRegenerateInviteCode } from '../hooks';

type Props = {
  groupId: string;
  groupName: string;
  /** Versión estrecha (junto a la imagen del grupo): código más pequeño y botones apilados. */
  compact?: boolean;
};

/** Solo para el owner: código del grupo, compartir enlace y generar uno nuevo. */
export function InviteCodeCard({ groupId, groupName, compact = false }: Props) {
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

  return (
    <View
      style={[styles.card, compact && styles.compactCard, { backgroundColor: colors.primarySoft }]}
    >
      <Text style={[styles.label, { color: colors.text }]}>Código para unirse</Text>
      {code.isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : code.isError ? (
        <Text style={[styles.label, { color: colors.danger }]}>{getErrorMessage(code.error)}</Text>
      ) : (
        <>
          <View style={styles.codeRow}>
            <Text
              style={[styles.code, compact && styles.compactCode, { color: colors.primary }]}
              adjustsFontSizeToFit
              numberOfLines={1}
              selectable
              accessibilityLabel={`Código: ${code.data.split('').join(' ')}`}
            >
              {formatInviteCode(code.data)}
            </Text>
            <Pressable
              onPress={() => copy(code.data)}
              accessibilityRole="button"
              accessibilityLabel={copied ? 'Código copiado' : 'Copiar código'}
              hitSlop={10}
              style={({ pressed }) => [styles.copyButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={compact ? 22 : 26}
                color={colors.primary}
              />
            </Pressable>
          </View>
          <View style={compact ? styles.compactActions : styles.actions}>
            <AppButton
              small={compact}
              title="Compartir enlace"
              onPress={() => share(code.data)}
              style={compact ? undefined : styles.flex}
            />
            <AppButton
              small={compact}
              title="Nuevo código"
              variant="secondary"
              onPress={confirmRegenerate}
              loading={regenerate.isPending}
              style={compact ? undefined : styles.flex}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, gap: 10, alignItems: 'center' },
  label: { fontSize: 15, fontFamily: fonts.detail },
  code: { fontSize: 34, fontFamily: fonts.title, letterSpacing: 3 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copyButton: { padding: 4 },
  compactCard: { padding: 12, gap: 8 },
  compactCode: { fontSize: 20, letterSpacing: 1.5, flexShrink: 1 },
  compactActions: { gap: 8, alignSelf: 'stretch' },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  flex: { flex: 1 },
});

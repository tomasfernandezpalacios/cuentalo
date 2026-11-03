import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';

import { buildInviteLink, formatInviteCode } from '../api';
import { useInviteCode, useRegenerateInviteCode } from '../hooks';

type Props = { groupId: string; groupName: string };

/** Solo para el owner: código del grupo, compartir enlace y generar uno nuevo. */
export function InviteCodeCard({ groupId, groupName }: Props) {
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
    Alert.alert(
      'Nuevo código',
      'El código y el enlace actuales dejarán de funcionar. Quien ya esté en el grupo sigue dentro.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cambiar código',
          onPress: () =>
            regenerate.mutate(undefined, {
              onError: (error) => Alert.alert('Error', getErrorMessage(error)),
            }),
        },
      ],
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.primarySoft }]}>
      <Text style={[styles.label, { color: colors.text }]}>Código para unirse</Text>
      {code.isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : code.isError ? (
        <Text style={[styles.label, { color: colors.danger }]}>{getErrorMessage(code.error)}</Text>
      ) : (
        <>
          <View style={styles.codeRow}>
            <Text
              style={[styles.code, { color: colors.primary }]}
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
                size={26}
                color={colors.primary}
              />
            </Pressable>
          </View>
          <View style={styles.actions}>
            <AppButton
              title="Compartir enlace"
              onPress={() => share(code.data)}
              style={styles.flex}
            />
            <AppButton
              title="Nuevo código"
              variant="secondary"
              onPress={confirmRegenerate}
              loading={regenerate.isPending}
              style={styles.flex}
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
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  flex: { flex: 1 },
});

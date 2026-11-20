import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import {
  REPORT_REASONS,
  type ReportKind,
  type ReportReason,
  useBlockUser,
  useReportContent,
} from '@/features/social/moderation';
import { getErrorMessage } from '@/lib/errors';
import { fonts, proseFont, useThemeColors } from '@/lib/theme';

/**
 * Denunciar a un usuario o un grupo (guía 1.2 de Apple y art. 16 del Reglamento de Servicios
 * Digitales). Se elige un motivo y, si se quiere, se explica. La denuncia llega al responsable de
 * la app (tabla `reports`); quien la envía no recibe nada más que el agradecimiento.
 */
export default function ReportScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ kind: ReportKind; id: string; name?: string }>();
  const kind: ReportKind = params.kind === 'group' ? 'group' : 'user';
  const name = params.name ?? '';
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const report = useReportContent();
  const block = useBlockUser();

  function afterSent() {
    const thanks =
      'Gracias por avisar. La revisaremos lo antes posible y, si incumple las normas, la ' +
      'retiraremos.';
    if (kind === 'user') {
      appAlert('Denuncia enviada', `${thanks}\n\n¿Quieres bloquear también a ${name}?`, [
        { text: 'No', style: 'cancel', onPress: () => router.back() },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: () =>
            block.mutate(params.id, {
              onSettled: () => router.back(),
              onError: (error) => appAlert('Error', getErrorMessage(error)),
            }),
        },
      ]);
    } else {
      appAlert('Denuncia enviada', thanks, [{ text: 'Cerrar', onPress: () => router.back() }]);
    }
  }

  function submit() {
    if (!reason) return;
    report.mutate(
      { kind, targetId: params.id, reason, details },
      { onSuccess: afterSent, onError: (error) => appAlert('Error', getErrorMessage(error)) },
    );
  }

  return (
    <FormScreen>
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        {kind === 'user'
          ? `¿Por qué denuncias a ${name}? Revisaremos su nombre, su foto y lo que comparte.`
          : `¿Por qué denuncias el grupo «${name}»? Revisaremos su nombre, su imagen y sus contadores.`}{' '}
        Nadie sabrá que has sido tú.
      </Text>

      <View style={styles.reasons} accessibilityRole="radiogroup">
        {REPORT_REASONS.map((r) => {
          const selected = reason === r.value;
          return (
            <Pressable
              key={r.value}
              onPress={() => setReason(r.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.reason,
                {
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={selected ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.reasonText, { color: colors.text }]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextField
        label="Cuéntanos más (opcional)"
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={1000}
        placeholder="Qué ha pasado, dónde lo has visto…"
        style={styles.details}
      />

      <AppButton
        title="Enviar denuncia"
        onPress={submit}
        disabled={!reason}
        loading={report.isPending || block.isPending}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  intro: { ...proseFont(16, 23) },
  reasons: { gap: 8 },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 48,
  },
  reasonText: { flex: 1, fontSize: 15, fontFamily: fonts.detail },
  details: { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
});

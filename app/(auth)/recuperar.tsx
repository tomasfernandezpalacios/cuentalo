import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { sendPasswordReset } from '@/features/auth/api';
import { getErrorMessage } from '@/lib/errors';
import { fonts, proseFont, useThemeColors } from '@/lib/theme';
import { validateEmail } from '@/lib/validation';

/**
 * «¿Olvidaste tu contraseña?»: pide el email y Supabase manda un correo con un enlace. Al
 * tocarlo en el móvil se abre Cuéntalo (`app/restablecer.tsx`) para elegir la contraseña nueva.
 */
export default function RecoverPasswordScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => sendPasswordReset(email),
    onSuccess: () => {
      setFormError(null);
      setSent(true);
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  function sendLink() {
    const error = validateEmail(email);
    setFormError(error);
    if (!error) send.mutate();
  }

  return (
    <FormScreen>
      {sent ? (
        <Text style={[styles.explain, { color: colors.text }]}>
          Si hay una cuenta con {email.trim()}, te hemos enviado un correo. Ábrelo en este móvil y
          toca el enlace: se abrirá Cuéntalo para que elijas tu contraseña nueva. Mira también en la
          carpeta de spam.
        </Text>
      ) : (
        <Text style={[styles.explain, { color: colors.textMuted }]}>
          Escribe el email de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.
        </Text>
      )}
      <TextField
        label="Email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setSent(false);
        }}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        onSubmitEditing={sendLink}
      />
      {formError ? <Text style={[styles.error, { color: colors.danger }]}>{formError}</Text> : null}
      <AppButton
        title={sent ? 'Enviar otro correo' : 'Enviar enlace'}
        variant={sent ? 'secondary' : 'primary'}
        onPress={sendLink}
        loading={send.isPending}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  explain: { ...proseFont(15, 21) },
  error: { fontFamily: fonts.detail },
});

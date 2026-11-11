import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { resetPasswordWithCode, sendPasswordReset } from '@/features/auth/api';
import { getErrorMessage } from '@/lib/errors';
import { fonts, proseFont, useThemeColors } from '@/lib/theme';
import { validateEmail, validatePassword } from '@/lib/validation';

/**
 * «¿Olvidaste tu contraseña?» en dos pasos:
 * 1. Tu email → Supabase te manda un email con un código.
 * 2. El código y la contraseña nueva → entras con la contraseña ya cambiada.
 * Con un código (y no un enlace) todo pasa dentro de la app, también en Expo Go.
 */
export default function RecoverPasswordScreen() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [formError, setFormError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => sendPasswordReset(email),
    onSuccess: () => {
      setFormError(null);
      setStep('code');
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  // Al cambiarla, ya hay sesión: la app pasa sola a la pantalla principal.
  const reset = useMutation({
    mutationFn: () => resetPasswordWithCode(email, code, password),
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  function sendCode() {
    const error = validateEmail(email);
    setFormError(error);
    if (!error) send.mutate();
  }

  function changePassword() {
    const error =
      (code.trim().length < 6 ? 'Escribe el código que te hemos enviado.' : null) ??
      validatePassword(password);
    setFormError(error);
    if (!error) reset.mutate();
  }

  return (
    <FormScreen>
      {step === 'email' ? (
        <>
          <Text style={[styles.explain, { color: colors.textMuted }]}>
            Escribe el email de tu cuenta y te enviaremos un código para elegir una contraseña
            nueva.
          </Text>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            onSubmitEditing={sendCode}
          />
          {formError ? (
            <Text style={[styles.error, { color: colors.danger }]}>{formError}</Text>
          ) : null}
          <AppButton title="Enviar código" onPress={sendCode} loading={send.isPending} />
        </>
      ) : (
        <>
          <Text style={[styles.explain, { color: colors.textMuted }]}>
            Si hay una cuenta con {email.trim()}, te hemos enviado un email con un código. Mira
            también en la carpeta de spam.
          </Text>
          <TextField
            label="Código"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
          />
          <TextField
            label="Contraseña nueva"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={changePassword}
          />
          {formError ? (
            <Text style={[styles.error, { color: colors.danger }]}>{formError}</Text>
          ) : null}
          <AppButton
            title="Cambiar contraseña y entrar"
            onPress={changePassword}
            loading={reset.isPending}
          />
          <AppButton
            title="Enviar otro código"
            variant="ghost"
            onPress={() => send.mutate()}
            loading={send.isPending}
          />
        </>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  explain: { ...proseFont(15, 21) },
  error: { fontFamily: fonts.detail },
});

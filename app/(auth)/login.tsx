import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { signIn } from '@/features/auth/api';
import { getErrorMessage } from '@/lib/errors';
import { useThemeColors } from '@/lib/theme';
import { validateEmail } from '@/lib/validation';

export default function LoginScreen() {
  const colors = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: () => signIn(email, password),
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  function handleSubmit() {
    const error = validateEmail(email) ?? (password === '' ? 'Escribe tu contraseña.' : null);
    setFormError(error);
    if (!error) login.mutate();
  }

  return (
    <FormScreen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Cuéntalo</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Cuenta lo que haces y compártelo con tus amigos.
        </Text>
      </View>

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={handleSubmit}
      />
      {formError ? <Text style={{ color: colors.danger }}>{formError}</Text> : null}

      <AppButton title="Entrar" onPress={handleSubmit} loading={login.isPending} />

      <AppButton
        title="¿No tienes cuenta? Regístrate"
        variant="ghost"
        onPress={() => router.push('/registro')}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 80, marginBottom: 24, gap: 8 },
  title: { fontSize: 36, fontWeight: '800' },
  subtitle: { fontSize: 16 },
});

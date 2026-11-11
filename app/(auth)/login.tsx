import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { isEmailLogin, signIn } from '@/features/auth/api';
import { getErrorMessage } from '@/lib/errors';
import { displayFont, fonts, proseFont, useThemeColors } from '@/lib/theme';
import { validateEmail, validateUsername } from '@/lib/validation';

/** Lo escrito en «Email o nombre de usuario»: un email válido o un nombre de usuario válido. */
function validateLogin(login: string): string | null {
  if (login.trim() === '') return 'Escribe tu email o tu nombre de usuario.';
  return isEmailLogin(login) ? validateEmail(login) : validateUsername(login);
}

export default function LoginScreen() {
  const colors = useThemeColors();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const signInMutation = useMutation({
    mutationFn: () => signIn(login, password),
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  function handleSubmit() {
    const error = validateLogin(login) ?? (password === '' ? 'Escribe tu contraseña.' : null);
    setFormError(error);
    if (!error) signInMutation.mutate();
  }

  return (
    <FormScreen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Cuéntalo
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Cuenta lo que haces y compártelo con tus amigos.
        </Text>
      </View>

      <TextField
        label="Email o nombre de usuario"
        value={login}
        onChangeText={setLogin}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
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
      {/* Justo debajo de la contraseña, a la derecha (petición del usuario). */}
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/recuperar',
            // Si ya escribió su email, se lleva rellenado.
            params: isEmailLogin(login) ? { email: login.trim() } : {},
          })
        }
        accessibilityRole="button"
        hitSlop={10}
        style={({ pressed }) => [styles.forgot, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={[styles.link, { color: colors.primary }]}>¿Olvidaste tu contraseña?</Text>
      </Pressable>
      {formError ? (
        <Text style={{ color: colors.danger, fontFamily: fonts.detail }}>{formError}</Text>
      ) : null}

      {/* «Entrar» y, pegado debajo, el enlace para registrarse. */}
      <View style={styles.actions}>
        <AppButton title="Entrar" onPress={handleSubmit} loading={signInMutation.isPending} />
        <AppButton
          title="¿No tienes cuenta? Regístrate"
          variant="ghost"
          onPress={() => router.push('/registro')}
        />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 80, marginBottom: 24, gap: 8 },
  title: { ...displayFont(36) },
  subtitle: { ...proseFont(17) },
  forgot: { alignSelf: 'flex-end', marginTop: -6 },
  link: { fontSize: 15, fontFamily: fonts.title },
  actions: { gap: 2 },
});

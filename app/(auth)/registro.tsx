import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { signUp } from '@/features/auth/api';
import { getErrorMessage } from '@/lib/errors';
import { fonts, useThemeColors } from '@/lib/theme';
import {
  LIMITS,
  validateEmail,
  validatePassword,
  validateRequiredText,
  validateUsername,
} from '@/lib/validation';

type Errors = Partial<Record<'displayName' | 'username' | 'email' | 'password', string | null>>;

export default function RegisterScreen() {
  const colors = useThemeColors();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const register = useMutation({
    mutationFn: () => signUp({ email, password, username, displayName }),
    onSuccess: ({ needsConfirmation }) => {
      // Sin confirmación por email, onAuthStateChange cambia de pantalla automáticamente.
      if (needsConfirmation) {
        appAlert('Revisa tu email', 'Te hemos enviado un enlace para confirmar tu cuenta.');
        router.back();
      }
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  function handleSubmit() {
    const next: Errors = {
      displayName: validateRequiredText(displayName, 'El nombre', LIMITS.displayName),
      username: validateUsername(username),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(next);
    setFormError(null);
    if (Object.values(next).every((error) => !error)) register.mutate();
  }

  return (
    <FormScreen>
      <TextField
        label="Nombre"
        value={displayName}
        onChangeText={setDisplayName}
        error={errors.displayName}
        autoComplete="name"
        placeholder="Cómo te verán tus amigos"
      />
      <TextField
        label="Nombre de usuario"
        value={username}
        onChangeText={setUsername}
        error={errors.username}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="ej. tomas_88"
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {formError ? (
        <Text style={{ color: colors.danger, fontFamily: fonts.detail }}>{formError}</Text>
      ) : null}

      <AppButton title="Crear cuenta" onPress={handleSubmit} loading={register.isPending} />
    </FormScreen>
  );
}

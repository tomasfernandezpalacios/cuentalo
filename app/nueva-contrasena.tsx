import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { appAlert } from '@/components/AppDialog';
import { AppButton } from '@/components/AppButton';
import { FormScreen } from '@/components/FormScreen';
import { TextField } from '@/components/TextField';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { fonts, proseFont, useThemeColors } from '@/lib/theme';
import { validatePassword } from '@/lib/validation';

/** Elegir la contraseña nueva tras entrar con el enlace del correo de recuperación. */
export default function NewPasswordScreen() {
  const colors = useThemeColors();
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      appAlert('Contraseña cambiada', 'Ya puedes entrar con tu contraseña nueva.');
      router.replace('/');
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  function handleSave() {
    const error = validatePassword(password);
    setFormError(error);
    if (!error) save.mutate();
  }

  return (
    <FormScreen>
      <Text style={[styles.explain, { color: colors.textMuted }]}>
        Elige una contraseña nueva para tu cuenta.
      </Text>
      <TextField
        label="Contraseña nueva"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={handleSave}
        autoFocus
      />
      {formError ? <Text style={[styles.error, { color: colors.danger }]}>{formError}</Text> : null}
      <AppButton title="Guardar contraseña" onPress={handleSave} loading={save.isPending} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  explain: { ...proseFont(15, 21) },
  error: { fontFamily: fonts.detail },
});

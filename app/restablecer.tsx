import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { parseRecoveryUrl } from '@/features/auth/recovery';
import { supabase } from '@/lib/supabase';
import { proseFont, titleFont, useThemeColors } from '@/lib/theme';

/**
 * Aquí llega el enlace del correo «¿Olvidaste tu contraseña?». Entra en la cuenta con lo que
 * trae el enlace y lleva a elegir la contraseña nueva. Está fuera de las zonas con y sin sesión
 * para que el enlace funcione en los dos casos.
 */
export default function RecoveryLinkScreen() {
  const colors = useThemeColors();
  const url = Linking.useURL();
  const handled = useRef(false);
  const [sessionError, setError] = useState<string | null>(null);
  const link = url ? parseRecoveryUrl(url) : null;
  // Un enlace caducado o ya usado trae el error en la propia dirección.
  const error =
    link?.kind === 'error'
      ? 'El enlace ha caducado o ya se ha usado. Pide otro desde «¿Olvidaste tu contraseña?».'
      : sessionError;

  useEffect(() => {
    if (!url || handled.current) return;
    const parsed = parseRecoveryUrl(url);
    if (parsed?.kind !== 'session') return;
    handled.current = true;
    const link = parsed;
    supabase.auth
      .setSession({ access_token: link.accessToken, refresh_token: link.refreshToken })
      .then(({ error: sessionError }) => {
        if (sessionError) {
          setError('No se ha podido abrir el enlace. Pide otro desde «¿Olvidaste tu contraseña?».');
          return;
        }
        router.replace('/nueva-contrasena');
      });
  }, [url]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {error ? (
        <>
          <Text style={[styles.title, { color: colors.text }]}>No ha funcionado</Text>
          <Text style={[styles.text, { color: colors.textMuted }]}>{error}</Text>
          <AppButton title="Volver" onPress={() => router.replace('/')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.text, { color: colors.textMuted }]}>Abriendo tu cuenta…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title: { ...titleFont(22), textAlign: 'center' },
  text: { ...proseFont(15, 21), textAlign: 'center' },
});

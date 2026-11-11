import { Stack } from 'expo-router';

import { BackButton } from '@/components/BackButton';
import { titleFont, useThemeColors } from '@/lib/theme';

export default function AuthLayout() {
  const colors = useThemeColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: titleFont(18),
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal',
        headerLeft: ({ canGoBack }) => (canGoBack ? <BackButton /> : null),
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="registro" options={{ title: 'Crear cuenta' }} />
      <Stack.Screen name="recuperar" options={{ title: 'Recuperar contraseña' }} />
    </Stack>
  );
}

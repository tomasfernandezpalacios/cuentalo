import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { BackButton } from '@/components/BackButton';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { usePendingInvite } from '@/features/social/pendingInvite';
import { queryClient } from '@/lib/queryClient';
import { fonts, useThemeColors } from '@/lib/theme';

// La pantalla de carga (icono sobre fondo liso, ver app.json) se mantiene hasta tener las
// fuentes y saber si hay sesión, para no enseñar un parpadeo de pantallas a medio cargar.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 200 });

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const colors = useThemeColors();
  const isSignedIn = session !== null;
  usePendingInvite(isSignedIn);

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.title },
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal',
        // Misma flecha en todas las pantallas, también en las que se abren como ventana
        // (donde por defecto no hay botón de volver).
        headerLeft: ({ canGoBack }) => (canGoBack ? <BackButton /> : null),
      }}
    >
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="contadores/nuevo"
          options={{ title: 'Nuevo contador', presentation: 'modal' }}
        />
        <Stack.Screen name="contadores/[id]/index" options={{ title: '' }} />
        <Stack.Screen
          name="contadores/[id]/editar"
          options={{ title: 'Editar contador', presentation: 'modal' }}
        />
        <Stack.Screen
          name="grupos/nuevo"
          options={{ title: 'Nuevo grupo', presentation: 'modal' }}
        />
        <Stack.Screen name="grupos/[id]/index" options={{ title: '' }} />
        <Stack.Screen
          name="grupos/[id]/editar"
          options={{ title: 'Editar grupo', presentation: 'modal' }}
        />
        <Stack.Screen
          name="grupos/[id]/invitar"
          options={{ title: 'Invitar amigos', presentation: 'modal' }}
        />
        <Stack.Screen name="usuario/[id]" options={{ title: '' }} />
        <Stack.Screen name="avisos" options={{ title: 'Buzón' }} />
        <Stack.Screen name="racha" options={{ title: 'Tu racha' }} />
        <Stack.Screen name="estadisticas/filtros" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="contadores/fusionar" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="carpetas/nueva" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="carpetas/[id]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen
          name="perfil/editar"
          options={{ title: 'Editar perfil', presentation: 'modal' }}
        />
        <Stack.Screen
          name="unirse/[code]"
          options={{ title: 'Unirse a un grupo', presentation: 'modal' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [fonts.title]: require('../assets/fonts/Ubuntu-Bold.ttf'),
    [fonts.detail]: require('../assets/fonts/Redaction-Regular.ttf'),
  });

  // Si las fuentes fallan seguimos con las del sistema en vez de bloquear la app.
  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

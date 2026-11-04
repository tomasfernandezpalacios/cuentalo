import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { DialogHost } from '@/components/AppDialog';
import { BackButton } from '@/components/BackButton';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { useReminderSync } from '@/features/configuracion/reminder';
import { usePendingInvite } from '@/features/social/pendingInvite';
import { TutorialHost } from '@/features/tutorial/TutorialHost';
import { useTutorialAutoStart } from '@/features/tutorial/useTutorialAutoStart';
import { queryClient } from '@/lib/queryClient';
import { fonts, useColorMode, useThemeColors } from '@/lib/theme';

// La pantalla de carga (icono sobre fondo liso, ver app.json) se mantiene hasta tener las
// fuentes y saber si hay sesión, para no enseñar un parpadeo de pantallas a medio cargar.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 200 });

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const colors = useThemeColors();
  const isSignedIn = session !== null;
  usePendingInvite(isSignedIn);
  useReminderSync(isSignedIn);
  useTutorialAutoStart(isSignedIn);

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
        <Stack.Screen
          name="grupos/[id]/administrador"
          options={{ title: 'Designar administrador' }}
        />
        <Stack.Screen name="usuario/[id]" options={{ title: '' }} />
        <Stack.Screen name="avisos" options={{ title: 'Buzón' }} />
        <Stack.Screen name="racha" options={{ title: 'Tu racha' }} />
        <Stack.Screen name="estadisticas/filtros" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="contadores/fusionar" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="carpetas/nueva" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="carpetas/[id]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="configuracion/index" options={{ title: 'Configuración' }} />
        <Stack.Screen
          name="configuracion/estadisticas"
          options={{ title: 'Gráfica de Estadísticas' }}
        />
        <Stack.Screen name="configuracion/privacidad" options={{ title: 'Privacidad y datos' }} />
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

/** Iconos de la barra de estado oscuros o claros según el tema elegido en Configuración. */
function ThemedStatusBar() {
  return <StatusBar style={useColorMode() === 'dark' ? 'light' : 'dark'} />;
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
        <TutorialHost />
        <DialogHost />
        <ThemedStatusBar />
      </AuthProvider>
    </QueryClientProvider>
  );
}

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import {
  DMSerifDisplay_400Regular,
  DMSerifDisplay_400Regular_Italic,
} from '@expo-google-fonts/dm-serif-display';
import { Fraunces_400Regular_Italic, Fraunces_800ExtraBold } from '@expo-google-fonts/fraunces';
import { Newsreader_400Regular, Newsreader_400Regular_Italic } from '@expo-google-fonts/newsreader';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { DialogHost } from '@/components/AppDialog';
import { UndoToastHost } from '@/components/UndoToast';
import { BackButton } from '@/components/BackButton';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { useReminderSync } from '@/features/configuracion/reminder';
import { useTimeZoneSync } from '@/features/perfil/useTimeZoneSync';
import { usePendingInvite } from '@/features/social/pendingInvite';
import { TutorialHost } from '@/features/tutorial/TutorialHost';
import { useTutorialAutoStart } from '@/features/tutorial/useTutorialAutoStart';
import { usePrefetchMain } from '@/lib/prefetch';
import { offlinePersister, setupOffline } from '@/lib/offline';
import { queryClient } from '@/lib/queryClient';
import { HeaderTitle } from '@/components/HeaderTitle';
import { TitleMeasurer, useScreenTitleSize } from '@/lib/screenTitle';
import { headerOptions, isCinema, useColorMode, useThemeColors } from '@/lib/theme';

// La pantalla de carga (icono sobre fondo liso, ver app.json) se mantiene hasta tener las
// fuentes y saber si hay sesión, para no enseñar un parpadeo de pantallas a medio cargar.
// Sin conexión: los +N/−1 esperan y se envían al volver (src/lib/offline.ts).
setupOffline(queryClient);

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 200 });

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const colors = useThemeColors();
  // Títulos de cabecera del mismo tamaño que el que cabe en «Mis contadores».
  const titleSize = useScreenTitleSize();
  const isSignedIn = session !== null;
  usePendingInvite(isSignedIn);
  useReminderSync(isSignedIn);
  useTutorialAutoStart(isSignedIn);
  useTimeZoneSync(isSignedIn);
  // Las pestañas principales, cargadas por detrás mientras sigue la pantalla de carga: al
  // entrar, todas tienen ya sus datos y están dibujadas (cambiar de pestaña es instantáneo).
  const mainReady = usePrefetchMain(isSignedIn && !isLoading);

  useEffect(() => {
    if (!isLoading && mainReady) SplashScreen.hideAsync();
  }, [isLoading, mainReady]);

  if (isLoading) return null;

  return (
    <Stack
      screenOptions={{
        ...headerOptions(colors, titleSize),
        // Cine: el título nunca se solapa con los botones de la derecha (se reduce si es largo).
        ...(isCinema
          ? {
              headerTitle: ({ children }: { children: string }) => (
                <HeaderTitle>{children}</HeaderTitle>
              ),
            }
          : {}),
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
          name="grupos/unirse"
          options={{ title: 'Unirse a un grupo', presentation: 'modal' }}
        />
        <Stack.Screen
          name="grupos/[id]/editar"
          options={{ title: 'Editar grupo', presentation: 'modal' }}
        />
        <Stack.Screen
          name="grupos/[id]/invitar"
          options={{ title: 'Invitar amigos', presentation: 'modal' }}
        />
        <Stack.Screen name="grupos/[id]/administrador" options={{ title: 'Designar líder' }} />
        <Stack.Screen name="usuario/[id]" options={{ title: '' }} />
        <Stack.Screen name="amigos/descubrir" options={{ title: 'Descubrir' }} />
        <Stack.Screen name="avisos" options={{ title: 'Buzón' }} />
        <Stack.Screen name="racha" options={{ title: 'Tu racha' }} />
        <Stack.Screen
          name="resumen"
          options={{ title: 'Resumen vital', presentation: 'fullScreenModal' }}
        />
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
        <Stack.Screen name="nueva-contrasena" options={{ title: 'Nueva contraseña' }} />
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
      {/* Enlace del correo de recuperar contraseña: con o sin sesión. */}
      <Stack.Screen name="restablecer" options={{ headerShown: false }} />
    </Stack>
  );
}

/** Iconos de la barra de estado oscuros o claros según el tema elegido en Configuración. */
function ThemedStatusBar() {
  return <StatusBar style={useColorMode() === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  // Las de los dos estilos (clásico y cine): se cargan siempre, son pocas.
  const [fontsLoaded, fontError] = useFonts({
    'Ubuntu-Bold': require('../assets/fonts/Ubuntu-Bold.ttf'),
    'Redaction-Regular': require('../assets/fonts/Redaction-Regular.ttf'),
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    'Redaction10-Regular': require('../assets/fonts/Redaction10-Regular.otf'),
    'Redaction10-Bold': require('../assets/fonts/Redaction10-Bold.otf'),
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    // Combinaciones de prueba (src/lib/typography.ts).
    Fraunces_800ExtraBold,
    Fraunces_400Regular_Italic,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_700Bold,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
    DMSans_400Regular,
    DMSans_700Bold,
  });

  // Si las fuentes fallan seguimos con las del sistema en vez de bloquear la app.
  if (!fontsLoaded && !fontError) return null;

  return (
    // Los cambios hechos sin conexión se guardan en el móvil y se envían al volver (offline.ts).
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: offlinePersister,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        dehydrateOptions: {
          // Solo lo pendiente de enviar (no los datos: esos se piden al abrir).
          shouldDehydrateQuery: () => false,
          shouldDehydrateMutation: (mutation) => mutation.state.isPaused,
        },
      }}
      onSuccess={() => void queryClient.resumePausedMutations()}
    >
      <AuthProvider>
        <RootNavigator />
        <UndoToastHost />
        <TutorialHost />
        <DialogHost />
        {isCinema ? <TitleMeasurer /> : null}
        <ThemedStatusBar />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

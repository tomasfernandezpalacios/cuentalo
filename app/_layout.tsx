import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { LoadingView } from '@/components/StateViews';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import { fonts, useThemeColors } from '@/lib/theme';

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const colors = useThemeColors();

  if (isLoading) return <LoadingView />;

  const isSignedIn = session !== null;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.title },
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal',
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
          name="grupos/[id]/invitar"
          options={{ title: 'Invitar amigos', presentation: 'modal' }}
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
  if (!fontsLoaded && !fontError) return <LoadingView />;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

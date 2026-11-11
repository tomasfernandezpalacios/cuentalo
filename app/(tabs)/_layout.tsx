import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import { PlatformPressable } from 'expo-router/react-navigation';
import type { ComponentProps } from 'react';
import { type ColorValue, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useInboxCount } from '@/features/social/hooks';
import type { TargetId } from '@/features/tutorial/steps';
import { TutorialTarget } from '@/features/tutorial/TutorialTarget';
import { fonts, headerOptions, isCinema, type ThemeColors, useThemeColors } from '@/lib/theme';
import { SummaryButton } from '@/features/estadisticas/components/SummaryButton';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    // Los tintes de la barra son siempre strings del tema; los tipos de ambas librerías no encajan.
    return (
      <Ionicons name={name} color={typeof color === 'string' ? color : undefined} size={size} />
    );
  };
}

/** Botón de pestaña normal, marcado para que el tutorial pueda iluminarlo. */
function tutorialTabButton(id: TargetId) {
  return function TabButton(props: ComponentProps<typeof PlatformPressable>) {
    return (
      <TutorialTarget id={id} style={styles.tabTarget}>
        <PlatformPressable {...props} />
      </TutorialTarget>
    );
  };
}

/**
 * Barra del estilo Cine: una cápsula flotante separada de los bordes, sin textos, y la pestaña
 * activa como una píldora blanco hueso con el icono casi negro. No es «absolute»: ocupa su sitio
 * y así no tapa el final de las listas.
 */
function cinemaTabBar(colors: ThemeColors, bottomInset: number) {
  return {
    tabBarShowLabel: false,
    tabBarActiveTintColor: colors.background,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarActiveBackgroundColor: colors.text,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopWidth: 0,
      borderRadius: 999,
      height: 64,
      paddingBottom: 0,
      paddingTop: 0,
      paddingHorizontal: 6,
      marginHorizontal: 20,
      marginBottom: bottomInset + 12,
      elevation: 0,
    },
    tabBarItemStyle: { borderRadius: 999, marginVertical: 7, marginHorizontal: 2 },
  };
}

export default function TabsLayout() {
  const colors = useThemeColors();
  // Punto rojo en «Amigos y grupos» mientras haya algo pendiente en el buzón.
  const inbox = useInboxCount();
  const insets = useSafeAreaInsets();
  return (
    // Fondo detrás de la barra (en el estilo Cine se ve alrededor de la cápsula).
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Tabs
        screenOptions={{
          ...headerOptions(colors),
          ...(isCinema
            ? cinemaTabBar(colors, insets.bottom)
            : {
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
                tabBarLabelStyle: { fontFamily: fonts.title },
              }),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Mis contadores', tabBarIcon: tabIcon('add-circle-outline') }}
        />
        <Tabs.Screen
          name="estadisticas"
          options={{
            title: 'Estadísticas',
            tabBarIcon: tabIcon('bar-chart-outline'),
            tabBarButton: tutorialTabButton('tab-estadisticas'),
            // «Generar resumen» (la primera vez) o el libro: abre el resumen de tu vida.
            headerRight: () => <SummaryButton />,
          }}
        />
        <Tabs.Screen
          name="social"
          options={{
            title: 'Amigos y grupos',
            tabBarIcon: tabIcon('people-outline'),
            tabBarButton: tutorialTabButton('tab-social'),
            tabBarBadge: inbox > 0 ? '' : undefined,
            tabBarBadgeStyle: {
              backgroundColor: colors.danger,
              minWidth: 10,
              maxHeight: 10,
              borderRadius: 5,
              marginTop: 2,
            },
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Mi perfil',
            tabBarIcon: tabIcon('person-circle-outline'),
            headerRight: () => (
              <Pressable
                onPress={() => router.push('/configuracion')}
                accessibilityRole="button"
                accessibilityLabel="Configuración"
                hitSlop={10}
                style={({ pressed }) => ({ marginRight: 16, opacity: pressed ? 0.6 : 1 })}
              >
                <Ionicons name="settings-outline" size={24} color={colors.text} />
              </Pressable>
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabTarget: { flex: 1 },
});

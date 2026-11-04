import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import { PlatformPressable } from 'expo-router/react-navigation';
import type { ComponentProps } from 'react';
import { type ColorValue, Pressable, StyleSheet } from 'react-native';

import { useInboxCount } from '@/features/social/hooks';
import type { TargetId } from '@/features/tutorial/steps';
import { TutorialTarget } from '@/features/tutorial/TutorialTarget';
import { fonts, useThemeColors } from '@/lib/theme';

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

export default function TabsLayout() {
  const colors = useThemeColors();
  // Punto rojo en «Amigos y grupos» mientras haya algo pendiente en el buzón.
  const inbox = useInboxCount();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.title },
        tabBarLabelStyle: { fontFamily: fonts.title },
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
  );
}

const styles = StyleSheet.create({
  tabTarget: { flex: 1 },
});

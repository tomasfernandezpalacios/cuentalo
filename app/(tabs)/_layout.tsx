import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

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

export default function TabsLayout() {
  const colors = useThemeColors();
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
        options={{ title: 'Estadísticas', tabBarIcon: tabIcon('bar-chart-outline') }}
      />
      <Tabs.Screen
        name="social"
        options={{ title: 'Amigos y grupos', tabBarIcon: tabIcon('people-outline') }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Mi perfil', tabBarIcon: tabIcon('person-circle-outline') }}
      />
    </Tabs>
  );
}

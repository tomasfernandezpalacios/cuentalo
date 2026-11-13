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
import { useScreenTitleSize } from '@/lib/screenTitle';
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

type TabButtonProps = ComponentProps<typeof PlatformPressable>;

/**
 * Botón de pestaña del estilo Cine: la librería pone el icono arriba y pinta la pestaña activa
 * como un rectángulo, así que se dibuja aquí: icono centrado y, si está activa, una píldora de
 * dorado suave (sin blanco).
 */
function CinemaTabButton({ style: _style, children, ...props }: TabButtonProps) {
  const colors = useThemeColors();
  const selected = props['aria-selected'] === true;
  return (
    <PlatformPressable
      {...props}
      android_ripple={{ color: 'transparent' }}
      style={[
        styles.cinemaTab,
        selected && { backgroundColor: colors.primarySoft, borderColor: colors.primary },
      ]}
    >
      {children}
    </PlatformPressable>
  );
}

/** El botón de cada pestaña (clásico o Cine), marcado si el tutorial lo ilumina. */
function tabButton(id?: TargetId) {
  return function TabButton(props: TabButtonProps) {
    const button = isCinema ? <CinemaTabButton {...props} /> : <PlatformPressable {...props} />;
    if (!id) return button;
    return (
      <TutorialTarget id={id} style={styles.tabTarget}>
        {button}
      </TutorialTarget>
    );
  };
}

/**
 * Barra del estilo Cine: una cápsula flotante separada de los bordes, sin textos, y la pestaña
 * activa como una píldora dorada suave con el icono dorado. No es «absolute»: ocupa su sitio y
 * así no tapa el final de las listas.
 */
function cinemaTabBar(colors: ThemeColors, bottomInset: number) {
  return {
    tabBarShowLabel: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarButton: tabButton(),
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopWidth: 0,
      borderRadius: 999,
      height: 64,
      paddingBottom: 0,
      paddingTop: 0,
      paddingHorizontal: 8,
      // Casi de borde a borde (petición del usuario), sin perder la forma redondeada.
      marginHorizontal: 6,
      marginBottom: bottomInset + 12,
      elevation: 0,
      shadowOpacity: 0,
    },
    tabBarItemStyle: { marginVertical: 8, marginHorizontal: 4 },
  };
}

export default function TabsLayout() {
  const colors = useThemeColors();
  // Punto rojo en «Amigos y grupos» mientras haya algo pendiente en el buzón.
  const inbox = useInboxCount();
  const insets = useSafeAreaInsets();
  const titleSize = useScreenTitleSize();
  return (
    // Fondo detrás de la barra (en el estilo Cine se ve alrededor de la cápsula).
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Tabs
        screenOptions={{
          ...headerOptions(colors, titleSize),
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
            tabBarButton: tabButton('tab-estadisticas'),
            // «Generar resumen» (la primera vez) o el libro: abre el resumen de tu vida.
            headerRight: () => <SummaryButton />,
          }}
        />
        <Tabs.Screen
          name="social"
          options={{
            title: 'Social',
            tabBarIcon: tabIcon('people-outline'),
            tabBarButton: tabButton('tab-social'),
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
  cinemaTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});

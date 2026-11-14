import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import {
  TopTabs,
  type MaterialTopTabBarProps,
  type MaterialTopTabNavigationOptions,
} from 'expo-router/js-top-tabs';
import { getHeaderTitle, Header, type HeaderOptions } from 'expo-router/react-navigation';
import { type ComponentProps, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StreakBadge } from '@/features/estadisticas/components/StreakBadge';
import { StreakCelebrationBar } from '@/features/estadisticas/components/StreakCelebrationBar';
import { SummaryButton } from '@/features/estadisticas/components/SummaryButton';
import { useInboxCount } from '@/features/social/hooks';
import { TITLE_GAP, useScreenTitleSize } from '@/lib/screenTitle';
import { headerOptions, screenTitleFont, useThemeColors } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Opciones de cada página: las del deslizador, las de la cabecera (que se pinta aquí) y el icono. */
type PageOptions = MaterialTopTabNavigationOptions & HeaderOptions & { icon?: IconName };

function pageOptions(options: PageOptions): MaterialTopTabNavigationOptions {
  return options;
}

/**
 * Barra del estilo Cine: una cápsula flotante sin textos. La píldora dorada suave de la pestaña
 * activa se desliza siguiendo al dedo mientras se pasa de una página a otra (`position`).
 */
function CinemaTabBar({
  state,
  descriptors,
  navigateToTab,
  position,
  insets,
}: MaterialTopTabBarProps) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const optionsOf = (key: string) => descriptors[key]?.options as PageOptions | undefined;
  const buttons = state.routes;
  const slot = buttons.length > 0 ? width / buttons.length : 0;
  const activeSlot = state.index;
  const translateX =
    state.routes.length > 1
      ? position.interpolate({
          inputRange: state.routes.map((_, i) => i),
          outputRange: state.routes.map((_, i) => i * slot),
          extrapolate: 'clamp',
        })
      : 0;

  return (
    <View
      style={[styles.bar, { backgroundColor: colors.surface, marginBottom: insets.bottom + 12 }]}
      accessibilityRole="tablist"
    >
      {/* Al subir la racha, los botones dejan sitio a la celebración de fuego. */}
      <StreakCelebrationBar>
        <View style={styles.items} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pill,
                {
                  width: slot - 8,
                  backgroundColor: colors.primarySoft,
                  borderColor: colors.primary,
                  transform: [{ translateX }],
                },
              ]}
            />
          ) : null}
          {buttons.map((route, index) => {
            const options = optionsOf(route.key);
            const selected = index === activeSlot;
            const color = selected ? colors.primary : colors.textMuted;
            return (
              <Pressable
                key={route.key}
                onPress={() => {
                  if (!selected) navigateToTab(route.key);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={options?.title}
                style={styles.item}
              >
                <View>
                  {options?.icon ? <Ionicons name={options.icon} size={24} color={color} /> : null}
                  {options?.tabBarBadge ? (
                    <View style={styles.badge}>{options.tabBarBadge()}</View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </StreakCelebrationBar>
    </View>
  );
}

/**
 * Las pestañas grandes son páginas una al lado de otra (petición del usuario): la página sigue
 * al dedo y, si se suelta a medias, se ven las dos hasta que termina de asentarse, igual que una
 * galería (react-native-tab-view con el deslizador nativo de react-native-pager-view). Orden:
 * Mis contadores, Estadísticas, Social (con Grupos y Amigos dentro) y Mi perfil. La cabecera de cada página se pinta
 * aquí con la de React Navigation y las mismas opciones de siempre.
 */
export default function TabsLayout() {
  const colors = useThemeColors();
  // Punto rojo en «Social» mientras haya algo pendiente en el buzón.
  const inbox = useInboxCount();
  const insets = useSafeAreaInsets();
  const titleSize = useScreenTitleSize();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <TopTabs
        tabBarPosition="bottom"
        tabBar={(props) => <CinemaTabBar {...props} insets={insets} />}
        screenLayout={({ children, route, options }) => (
          <View style={[styles.root, { backgroundColor: colors.background }]}>
            <Header
              {...(options as PageOptions)}
              title={getHeaderTitle(options as PageOptions, route.name)}
            />
            {children}
          </View>
        )}
        screenOptions={pageOptions({
          ...headerOptions(colors, titleSize),
          // Todas las páginas se dibujan desde el principio (detrás de la pantalla de carga): al
          // deslizar o cambiar de pestaña, la otra ya está lista, nunca en blanco.
          lazy: false,
        })}
      >
        <TopTabs.Screen
          name="index"
          options={pageOptions({ title: 'Mis contadores', icon: 'add-circle-outline' })}
        />
        <TopTabs.Screen
          name="estadisticas"
          options={pageOptions({
            title: 'Estadísticas',
            icon: 'bar-chart-outline',
            // Título con la racha a su derecha. La racha no cambia el tamaño común de los títulos.
            headerTitle: () => (
              <View style={styles.titleRow}>
                <Text
                  style={[screenTitleFont(titleSize), { color: colors.text }]}
                  numberOfLines={1}
                >
                  Estadísticas
                </Text>
                <StreakBadge />
              </View>
            ),
            // «Resumen vital» (la primera vez) o el libro: abre el resumen de tu vida.
            headerRight: () => <SummaryButton />,
          })}
        />
        <TopTabs.Screen
          name="social"
          options={pageOptions({
            title: 'Social',
            icon: 'people-outline',
            tabBarBadge:
              inbox > 0
                ? () => <View style={[styles.dot, { backgroundColor: colors.danger }]} />
                : undefined,
          })}
        />
        <TopTabs.Screen
          name="perfil"
          options={pageOptions({
            title: 'Mi perfil',
            icon: 'person-circle-outline',
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
          })}
        />
      </TopTabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: TITLE_GAP },
  // Casi de borde a borde, sin perder la forma redondeada.
  bar: { height: 64, borderRadius: 999, marginHorizontal: 6, paddingHorizontal: 8 },
  items: { flex: 1, flexDirection: 'row' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', top: 8, bottom: 8, left: 4, borderRadius: 999, borderWidth: 1 },
  badge: { position: 'absolute', top: -2, right: -6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});

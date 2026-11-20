import Feather from '@expo/vector-icons/Feather';
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
import { MascotFace } from '@/features/mascota/MascotFace';
import { CoinBurstLayer } from '@/features/progreso/components/CoinBurstLayer';
import { LevelUpCelebration } from '@/features/progreso/components/LevelUpCelebration';
import { ProgressHeaderStats } from '@/features/progreso/components/CoinsButton';
import { useAutoShields } from '@/features/progreso/useAutoShields';
import { StreakCelebrationBar } from '@/features/estadisticas/components/StreakCelebrationBar';
import { SummaryButton } from '@/features/estadisticas/components/SummaryButton';
import { useInboxCount } from '@/features/social/hooks';
import { TITLE_GAP, useScreenTitleSize } from '@/lib/screenTitle';
import {
  TAB_BALL_MODE,
  TAB_BALL_RISE,
  TAB_BAR_HEIGHT,
  TAB_PILL_HEIGHT,
  TAB_PILL_WIDTH,
} from '@/lib/tabBar';
import { markSwipeEnd, markSwipeStart } from '@/lib/tapGuard';
import { headerOptions, screenTitleFont, useThemeColors } from '@/lib/theme';

/** Al entrar se abre siempre «Mis contadores», la primera (petición del usuario). */
export const unstable_settings = { initialRouteName: 'index' };

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Opciones de cada página: las del deslizador, las de la cabecera (que se pinta aquí) y el icono. */
type PageOptions = MaterialTopTabNavigationOptions &
  HeaderOptions & {
    icon?: IconName;
    /** Icono de Feather en vez de Ionicons (la casa de «Mis contadores», de líneas simples). */
    featherIcon?: ComponentProps<typeof Feather>['name'];
    /** La cara de la mascota en vez de un icono («Progreso»). */
    mascotIcon?: boolean;
  };

/**
 * Icono de una pestaña: la cara de la mascota, el de Feather o el de Ionicons. La cara va en el
 * color apagado de los iconos si no está elegida (`lit` falso) y dorada, la suya, si lo está.
 */
function PageIcon({
  options,
  size,
  color,
  lit = false,
}: {
  options: PageOptions;
  size: number;
  color: string;
  lit?: boolean;
}) {
  if (options.mascotIcon) {
    return <MascotFace size={size + 2} color={lit ? undefined : color} />;
  }
  if (options.featherIcon) {
    return <Feather name={options.featherIcon} size={size - 2} color={color} />;
  }
  return options.icon ? <Ionicons name={options.icon} size={size} color={color} /> : null;
}

function pageOptions(options: PageOptions): MaterialTopTabNavigationOptions {
  return options;
}

/** Diámetro de la bola: algo más alta que la barra, como en el boceto. */
const BALL = 66;
/** Cuánto crece el icono de la pestaña activa. */
const ACTIVE_SCALE = 1.25;
/** En la forma mixta, tamaño de la bola fuera del centro (cabe dentro de la barra). */
const SIDE_BALL_SCALE = 0.8;

/**
 * Barra del estilo Cine: una franja pegada abajo sin textos con cinco pestañas; la activa se marca
 * con un óvalo dorado suave o una bola dorada (ver `TAB_BALL_MODE`). Todo sigue al dedo mientras se pasa de una página a
 * otra (`position`).
 */
function CinemaTabBar({ state, descriptors, jumpTo, position, insets }: MaterialTopTabBarProps) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const optionsOf = (key: string) => descriptors[key]?.options as PageOptions | undefined;
  const buttons = state.routes;
  const slot = buttons.length > 0 ? width / buttons.length : 0;
  const activeSlot = state.index;
  const centerSlot = Math.floor(buttons.length / 2);
  const fixedCenter = TAB_BALL_MODE === 'center';
  // Forma mixta: un aro dorado suave marca siempre el centro y la bola se desliza a la activa,
  // grande en el centro y más pequeña (dentro de la barra) en las demás.
  const mixed = TAB_BALL_MODE === 'mixed';
  // Óvalo: rodea el icono activo dentro de la barra y se desliza de una pestaña a otra.
  const pill = TAB_BALL_MODE === 'pill';
  const pillWidth = Math.min(TAB_PILL_WIDTH, slot - 4);
  const pillX =
    buttons.length > 1
      ? position.interpolate({
          inputRange: buttons.map((_, i) => i),
          outputRange: buttons.map((_, i) => i * slot + (slot - pillWidth) / 2),
          extrapolate: 'clamp',
        })
      : (slot - pillWidth) / 2;
  const translateX = fixedCenter
    ? centerSlot * slot + (slot - BALL) / 2
    : state.routes.length > 1
      ? position.interpolate({
          inputRange: state.routes.map((_, i) => i),
          outputRange: state.routes.map((_, i) => i * slot + (slot - BALL) / 2),
          extrapolate: 'clamp',
        })
      : (slot - BALL) / 2;
  // Con la bola fija, crece un poco al estar en «Mis contadores»; en la mixta, encoge fuera del
  // centro.
  const ballScale = fixedCenter
    ? position.interpolate({
        inputRange: [centerSlot - 1, centerSlot, centerSlot + 1],
        outputRange: [0.9, 1, 0.9],
        extrapolate: 'clamp',
      })
    : mixed && buttons.length > 1
      ? position.interpolate({
          inputRange: buttons.map((_, i) => i),
          outputRange: buttons.map((_, i) => (i === centerSlot ? 1 : SIDE_BALL_SCALE)),
          extrapolate: 'clamp',
        })
      : 1;

  return (
    <View
      style={[
        styles.bar,
        // Pegada abajo y a todo lo ancho (petición del usuario): cubre también la zona segura.
        {
          backgroundColor: colors.surface,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
      ]}
      accessibilityRole="tablist"
    >
      {/* Al subir la racha, los botones dejan sitio a la celebración de fuego. */}
      <StreakCelebrationBar edge={BAR_PADDING} bottomInset={insets.bottom}>
        <View style={styles.items} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 && mixed ? (
            <View
              pointerEvents="none"
              style={[
                styles.ball,
                styles.ring,
                {
                  backgroundColor: colors.primarySoft,
                  borderColor: colors.primary,
                  transform: [{ translateX: centerSlot * slot + (slot - BALL) / 2 }],
                },
              ]}
            />
          ) : null}
          {width > 0 && pill ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pill,
                {
                  width: pillWidth,
                  backgroundColor: colors.primarySoft,
                  borderColor: colors.primary,
                  transform: [{ translateX: pillX }],
                },
              ]}
            />
          ) : null}
          {width > 0 && !pill ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ball,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.background,
                  transform: [{ translateX }, { scale: ballScale }],
                },
              ]}
            />
          ) : null}
          {buttons.map((route, index) => {
            const options = optionsOf(route.key);
            const selected = index === activeSlot;
            // Pestaña que está dentro de la bola: con la bola fija, siempre la del centro.
            const inBall = fixedCenter && index === centerSlot;
            // En la mixta, el icono del centro es dorado sobre su aro cuando no tiene la bola.
            const onRing = mixed && index === centerSlot;
            // Color y tamaño siguen a la bola (`position`), no al índice: mientras el deslizador
            // se asienta el índice puede pasar un momento por otra pestaña y parpadeaba.
            const lit = position.interpolate({
              inputRange: [index - 1, index, index + 1],
              outputRange: [0, 1, 0],
              extrapolate: 'clamp',
            });
            const scale = position.interpolate({
              inputRange: [index - 1, index, index + 1],
              // Dentro del óvalo crece menos para no tocar su borde.
              outputRange: inBall ? [1, 1.1, 1] : pill ? [1, 1.12, 1] : [1, ACTIVE_SCALE, 1],
              extrapolate: 'clamp',
            });
            // La bola va más arriba que la barra: el icono que está dentro sube con ella (el que
            // la recibe sube a medida que llega).
            const rise =
              inBall || onRing
                ? -TAB_BALL_RISE
                : fixedCenter || pill
                  ? 0
                  : lit.interpolate({ inputRange: [0, 1], outputRange: [0, -TAB_BALL_RISE] });
            return (
              <Pressable
                key={route.key}
                onPress={() => {
                  // `jumpTo` del deslizador mueve la página al momento (en el hilo nativo) y después
                  // avisa a la navegación. Con `navigateToTab` la página no se movía hasta que la
                  // navegación volvía a dibujar las cinco pestañas: se notaba que «pensaba».
                  if (!selected) jumpTo(route.key);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={options?.title}
                style={styles.item}
              >
                <Animated.View style={{ transform: [{ translateY: rise }, { scale }] }}>
                  {options && inBall ? (
                    <PageIcon options={options} size={28} color={colors.onPrimary} lit />
                  ) : options ? (
                    <>
                      <PageIcon
                        options={options}
                        size={onRing ? 26 : 24}
                        color={onRing ? colors.primary : colors.textMuted}
                      />
                      <Animated.View style={[StyleSheet.absoluteFill, { opacity: lit }]}>
                        <PageIcon
                          options={options}
                          size={onRing ? 26 : 24}
                          color={fixedCenter || pill ? colors.primary : colors.onPrimary}
                          lit
                        />
                      </Animated.View>
                    </>
                  ) : null}
                  {options?.tabBarBadge ? (
                    <View style={styles.badge}>{options.tabBarBadge()}</View>
                  ) : null}
                </Animated.View>
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
 * galería (react-native-tab-view con el deslizador nativo de react-native-pager-view). Orden
 * (petición del usuario, 2026-11-20): Mis contadores (inicio, a la izquierda y la que se abre
 * siempre al entrar), Estadísticas, Progreso, Social y Mi perfil. La cabecera de cada página se pinta aquí con la
 * de React Navigation y las mismas opciones de siempre.
 */
export default function TabsLayout() {
  const colors = useThemeColors();
  // Punto rojo en «Social» mientras haya algo pendiente en el buzón.
  const inbox = useInboxCount();
  const insets = useSafeAreaInsets();
  const titleSize = useScreenTitleSize();
  // Si ayer no mantuviste la racha, se gasta un protector (si tienes).
  useAutoShields();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <TopTabs
        tabBarPosition="bottom"
        // Mientras se desliza entre pestañas, los toques de dentro no cuentan (`Tappable`).
        screenListeners={{ swipeStart: markSwipeStart, swipeEnd: () => markSwipeEnd() }}
        // La barra flota encima de las páginas sin fondo propio: alrededor de la cápsula se ve
        // el contenido de detrás, no una franja del color del fondo. Las listas dejan sitio al
        // final con `useTabBarSpace`.
        tabBar={(props) => (
          <View pointerEvents="box-none" style={styles.tabBarOverlay}>
            <CinemaTabBar {...props} insets={insets} />
          </View>
        )}
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
          options={pageOptions({ title: 'Mis contadores', featherIcon: 'home' })}
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
          name="progreso"
          options={pageOptions({
            title: 'Progreso',
            mascotIcon: true,
            // Tus monedas (al tocarlas se abre la tienda).
            headerRight: () => <ProgressHeaderStats />,
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
      {/* Monedas ganadas volando hacia el botón de monedas («Progreso»). */}
      <CoinBurstLayer />
      {/* Subir de nivel, a pantalla completa. */}
      <LevelUpCelebration />
    </View>
  );
}

/** Relleno de la barra de pestañas a cada lado (la celebración de la racha lo cubre también). */
const BAR_PADDING = 6;

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: TITLE_GAP },
  tabBarOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: {
    paddingHorizontal: BAR_PADDING,
  },
  items: { flex: 1, flexDirection: 'row' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Centrada en la barra y más alta que ella: sobresale un poco por arriba y por abajo. El borde
  // del color del fondo la separa de la barra.
  ball: {
    position: 'absolute',
    left: 0,
    top: (TAB_BAR_HEIGHT - BALL) / 2 - TAB_BALL_RISE,
    width: BALL,
    height: BALL,
    borderRadius: BALL / 2,
    borderWidth: 3,
  },
  ring: { borderWidth: 1.5 },
  pill: {
    position: 'absolute',
    left: 0,
    top: (TAB_BAR_HEIGHT - TAB_PILL_HEIGHT) / 2,
    height: TAB_PILL_HEIGHT,
    borderRadius: TAB_PILL_HEIGHT / 2,
    borderWidth: 1,
  },
  badge: { position: 'absolute', top: -2, right: -6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});

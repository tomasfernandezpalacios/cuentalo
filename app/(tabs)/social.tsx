import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import { useTabAnimation } from 'expo-router/js-top-tabs';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { FriendsPanel } from '@/features/social/components/FriendsPanel';
import { GroupsPanel } from '@/features/social/components/GroupsPanel';
import { socialKeys, useInboxCount } from '@/features/social/hooks';
import { StableScreenOptions } from '@/lib/stableOptions';
import { useThemeColors } from '@/lib/theme';

type Tab = 'friends' | 'groups';

/** Posición de Social entre las pestañas grandes (Mis contadores, Estadísticas, Social, Mi perfil). */
const SOCIAL_INDEX = 2;

/**
 * Deslizamiento «fuerte y grande» (petición del usuario): al menos este recorrido (fracción del
 * ancho) y esta velocidad (puntos por ms). Con él se pasa de pestaña grande aunque haya subpestaña al
 * lado; uno suave y despacio pasa de subpestaña en subpestaña.
 */
const STRONG_DISTANCE = 0.3;
const STRONG_SPEED = 0.8;

const TABS: { value: Tab; label: string }[] = [
  { value: 'groups', label: 'Grupos' },
  { value: 'friends', label: 'Amigos' },
];

export default function SocialScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('groups');
  const [refreshing, setRefreshing] = useState(false);
  const inbox = useInboxCount();
  const navigation = useNavigation();
  const pager = useRef<ComponentRef<typeof Animated.ScrollView>>(null);
  // Para pasar a la pestaña grande de al lado: el dedo y el arrastre del deslizador de dentro.
  const touch = useRef<{ x: number; lastX: number; tab: Tab } | null>(null);
  const drag = useRef<{ offset: number; time: number } | null>(null);
  // Desplazamiento de las páginas: la iluminación del selector lo sigue (se desliza, no salta).
  const [scrollX] = useState(() => new Animated.Value(0));
  const position = scrollX.interpolate({
    inputRange: [0, Math.max(1, width)],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  async function refresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: socialKeys.all });
    setRefreshing(false);
  }

  /** Tocar el selector: la página se desliza a su sitio. */
  // Se entra en Social siempre por Grupos, venga de donde venga (petición del usuario): adelante
  // Estadísticas → Grupos → Amigos → Mi perfil; atrás Mi perfil → Grupos → Estadísticas. En
  // cuanto otra pestaña grande queda del todo en pantalla (Social ya no se ve), la página
  // interna vuelve a Grupos sin animación, así nunca se ve el salto.
  const { position: tabPosition } = useTabAnimation();
  useEffect(() => {
    const id = tabPosition.addListener(({ value }) => {
      if (Math.abs(value - SOCIAL_INDEX) < 0.99 || tab === 'groups') return;
      setTab('groups');
      pager.current?.scrollTo({ x: 0, animated: false });
    });
    return () => tabPosition.removeListener(id);
  }, [tabPosition, width, tab]);

  function selectTab(next: Tab) {
    setTab(next);
    pager.current?.scrollTo({ x: next === 'groups' ? 0 : width, animated: true });
  }

  /** Al deslizar, el selector cambia en cuanto se pasa la mitad (sin esperar a que pare). */
  function onPagerScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next: Tab = e.nativeEvent.contentOffset.x > width / 2 ? 'friends' : 'groups';
    if (next !== tab) setTab(next);
  }

  // El dedo: dónde empezó y por dónde va. Android deja de mandar el toque en cuanto el
  // deslizador de dentro toma el gesto (no llega el «soltar»), pero los primeros movimientos sí
  // llegan y bastan para saber hacia dónde va.
  function onTouchStart(e: GestureResponderEvent) {
    const { pageX } = e.nativeEvent;
    touch.current = { x: pageX, lastX: pageX, tab };
  }

  function onTouchMove(e: GestureResponderEvent) {
    if (touch.current) touch.current.lastX = e.nativeEvent.pageX;
  }

  function onScrollBeginDrag(e: NativeSyntheticEvent<NativeScrollEvent>) {
    drag.current = { offset: e.nativeEvent.contentOffset.x, time: Date.now() };
  }

  /**
   * Al soltar el deslizador de dentro (este evento llega siempre, también en los bordes):
   * - Suave y despacio: de subpestaña en subpestaña (lo hace el propio deslizador) y, desde los
   *   bordes, a la pestaña de al lado (Grupos → Estadísticas, Amigos → Mi perfil).
   * - Fuerte y grande: directamente a la pestaña grande de al lado; el deslizador de dentro se
   *   queda donde estaba.
   */
  function onScrollEndDrag(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const finger = touch.current;
    const started = drag.current;
    drag.current = null;
    if (!finger || !started) return;
    const moved = e.nativeEvent.contentOffset.x - started.offset;
    // Dedo hacia la derecha (> 0) o hacia la izquierda (< 0). Si el contenido se ha movido, eso
    // manda; si no (en un borde), los primeros movimientos del dedo.
    const direction = moved !== 0 ? -Math.sign(moved) : Math.sign(finger.lastX - finger.x);
    if (direction === 0) return;
    const elapsed = Math.max(1, Date.now() - started.time);
    const strong =
      Math.abs(moved) >= width * STRONG_DISTANCE && Math.abs(moved) / elapsed >= STRONG_SPEED;
    const atEdge =
      (direction > 0 && finger.tab === 'groups') || (direction < 0 && finger.tab === 'friends');
    if (!strong && !atEdge) return;
    if (strong) {
      // Deshace el paso de subpestaña que haya empezado el deslizador de dentro.
      pager.current?.scrollTo({ x: finger.tab === 'groups' ? 0 : width, animated: false });
      setTab(finger.tab);
    }
    navigation.navigate((direction > 0 ? 'estadisticas' : 'perfil') as never);
  }

  const refreshControl = (
    <RefreshControl
      tintColor={colors.primary}
      colors={[colors.primary]}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );

  return (
    <View
      style={[styles.flex, { backgroundColor: colors.background }]}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
    >
      <StableScreenOptions
        options={{
          // collapsable={false}: con varios botones en la cabecera nativa de Android, sin él los
          // toques pueden no llegar.
          headerRight: () => (
            <View collapsable={false} style={styles.headerActions}>
              <Pressable
                onPress={() => router.push('/grupos/unirse')}
                accessibilityRole="button"
                accessibilityLabel="Unirme a un grupo con un código"
                hitSlop={10}
              >
                <Ionicons name="key-outline" size={24} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/avisos')}
                accessibilityRole="button"
                accessibilityLabel={inbox > 0 ? `Buzón, ${inbox} pendientes` : 'Buzón de avisos'}
                hitSlop={10}
              >
                <Ionicons name="mail-outline" size={25} color={colors.primary} />
                {inbox > 0 ? (
                  <View style={[styles.badge, { backgroundColor: colors.danger }]} />
                ) : null}
              </Pressable>
              {/* Crear grupo: el mismo + que en «Mis contadores». */}
              <Pressable
                onPress={() => router.push('/grupos/nuevo')}
                accessibilityRole="button"
                accessibilityLabel="Crear grupo"
                hitSlop={6}
                style={({ pressed }) => [
                  styles.addButton,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons name="add" size={26} color={colors.background} />
              </Pressable>
            </View>
          ),
          // Entre Grupos y Amigos se desliza dentro de la pestaña (las páginas grandes no se mueven
          // aquí); desde los bordes se pasa a la pestaña de al lado (onScrollEndDrag).
          swipeEnabled: false,
        }}
        optionsKey={`${colors.primary}|${colors.background}|${colors.danger}|${inbox}`}
      />
      <View style={styles.selector}>
        <SegmentedControl options={TABS} value={tab} onChange={selectTab} position={position} />
      </View>
      {/* Grupos y Amigos, una al lado de la otra: se pasa de una a otra deslizando de lado como
          en una galería (desplazamiento nativo, sigue al dedo y se asienta solo). Cada página
          tiene su propio desplazamiento vertical. */}
      <Animated.ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
          listener: onPagerScroll,
        })}
        scrollEventThrottle={16}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        keyboardShouldPersistTaps="handled"
        style={styles.flex}
      >
        <ScrollView
          style={{ width }}
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          <GroupsPanel />
        </ScrollView>
        <ScrollView
          style={{ width }}
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          <FriendsPanel />
        </ScrollView>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  selector: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  page: { padding: 16, paddingTop: 16, gap: 20 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginRight: 14 },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: { position: 'absolute', top: -1, right: -3, width: 10, height: 10, borderRadius: 5 },
});

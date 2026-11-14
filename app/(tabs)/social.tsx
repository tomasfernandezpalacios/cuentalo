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

/** Distancia mínima para pasar de pestaña desde un borde. */
const EDGE_SWIPE = 60;

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
  // Comienzo del toque, para pasar a la pestaña de al lado desde los bordes.
  const touchStart = useRef<{ x: number; y: number; tab: Tab } | null>(null);
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
  // Al llegar a Social deslizando, se entra por el lado del que se viene: desde Estadísticas a
  // Grupos y desde Mi perfil a Amigos (y de ahí, otra vez a Grupos y a Estadísticas). Mientras las
  // páginas grandes se mueven, la página de Social ya está en su sitio.
  const { position: tabPosition } = useTabAnimation();
  useEffect(() => {
    const id = tabPosition.addListener(({ value }) => {
      if (Math.abs(value - SOCIAL_INDEX) < 0.01) return;
      const side: Tab = value > SOCIAL_INDEX ? 'friends' : 'groups';
      if (side === tab) return;
      setTab(side);
      pager.current?.scrollTo({ x: side === 'groups' ? 0 : width, animated: false });
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

  function onTouchStart(e: GestureResponderEvent) {
    const { pageX, pageY } = e.nativeEvent;
    touchStart.current = { x: pageX, y: pageY, tab };
  }

  /**
   * Bordes: deslizar a la derecha en Grupos pasa a Estadísticas y a la izquierda en Amigos, a Mi
   * perfil. Entre Grupos y Amigos se desliza dentro de esta misma pestaña.
   */
  function onTouchEnd(e: GestureResponderEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.nativeEvent.pageX - start.x;
    const dy = e.nativeEvent.pageY - start.y;
    if (Math.abs(dx) < EDGE_SWIPE || Math.abs(dx) < 2 * Math.abs(dy)) return;
    if (dx > 0 && start.tab === 'groups') navigation.navigate('estadisticas' as never);
    if (dx < 0 && start.tab === 'friends') navigation.navigate('perfil' as never);
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
      onTouchEnd={onTouchEnd}
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
          // aquí); desde los bordes se pasa a la pestaña de al lado (onTouchEnd).
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

import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
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
  const pager = useRef<ComponentRef<typeof Animated.ScrollView>>(null);
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

  // Social se abre siempre por Grupos (petición del usuario): en cuanto otra pestaña grande queda
  // del todo en pantalla (Social ya no se ve), la subpestaña vuelve a Grupos sin animación.
  const { position: tabPosition } = useTabAnimation();
  useEffect(() => {
    const id = tabPosition.addListener(({ value }) => {
      if (Math.abs(value - SOCIAL_INDEX) < 0.99 || tab === 'groups') return;
      setTab('groups');
      pager.current?.scrollTo({ x: 0, animated: false });
    });
    return () => tabPosition.removeListener(id);
  }, [tabPosition, width, tab]);

  /** Tocar el selector: la subpestaña se desliza a su sitio (es la única forma de cambiarla). */
  function selectTab(next: Tab) {
    setTab(next);
    pager.current?.scrollTo({ x: next === 'groups' ? 0 : width, animated: true });
  }

  /** Mientras se desliza la subpestaña, el selector cambia en cuanto se pasa la mitad. */
  function onPagerScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next: Tab = e.nativeEvent.contentOffset.x > width / 2 ? 'friends' : 'groups';
    if (next !== tab) setTab(next);
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
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
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
        }}
        optionsKey={`${colors.primary}|${colors.background}|${colors.danger}|${inbox}`}
      />
      <View style={styles.selector}>
        <SegmentedControl options={TABS} value={tab} onChange={selectTab} position={position} />
      </View>
      {/* Grupos y Amigos, una al lado de la otra: el selector desliza de una a otra. Cada página
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
        // Grupos y Amigos se cambian solo con el selector (petición del usuario): deslizar el dedo
        // es siempre para pasar a la pestaña grande de al lado, esté en la subpestaña que esté.
        scrollEnabled={false}
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

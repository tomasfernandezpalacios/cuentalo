import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { FriendsPanel } from '@/features/social/components/FriendsPanel';
import { GroupsPanel } from '@/features/social/components/GroupsPanel';
import { socialKeys, useInboxCount } from '@/features/social/hooks';
import { useThemeColors } from '@/lib/theme';

type Tab = 'friends' | 'groups';

const TABS: { value: Tab; label: string }[] = [
  { value: 'groups', label: 'Grupos' },
  { value: 'friends', label: 'Amigos' },
];

/** Cuánto hay que deslizar de lado (puntos) para pasar de Grupos a Amigos o al revés. */
const SWIPE_MIN = 60;

/** Lo que el gesto necesita del último render (fuera de React, con métodos para cambiarlo). */
function createSwipeState(initial: Tab) {
  let tab = initial;
  let change: (tab: Tab) => void = () => {};
  return {
    tab: () => tab,
    change: (next: Tab) => change(next),
    update: (value: Tab, onChange: (tab: Tab) => void) => {
      tab = value;
      change = onChange;
    },
  };
}

/**
 * Deslizar de lado para cambiar entre Grupos y Amigos (además del selector): el contenido sigue
 * un poco al dedo y el nuevo entra desde el lado contrario. Solo se queda con gestos claramente
 * horizontales; los verticales siguen moviendo la lista.
 */
function useTabSwipe(tab: Tab, setTab: (tab: Tab) => void) {
  const [offset] = useState(() => new Animated.Value(0));
  const [state] = useState(() => createSwipeState(tab));
  useEffect(() => {
    state.update(tab, setTab);
  });

  function slide(toValue: number, done?: () => void) {
    Animated.timing(offset, {
      toValue,
      duration: 170,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(done);
  }

  const [responder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderMove: (_e, g) => {
        // Hacia donde no hay pestaña, se mueve poco (para notar que no hay más).
        const current = state.tab();
        const blocked = (current === 'groups' && g.dx > 0) || (current === 'friends' && g.dx < 0);
        offset.setValue(g.dx * (blocked ? 0.15 : 0.5));
      },
      onPanResponderRelease: (_e, g) => {
        const current = state.tab();
        const next =
          current === 'groups' && g.dx <= -SWIPE_MIN
            ? 'friends'
            : current === 'friends' && g.dx >= SWIPE_MIN
              ? 'groups'
              : null;
        if (!next) {
          slide(0);
          return;
        }
        const out = next === 'friends' ? -80 : 80;
        slide(out, () => {
          state.change(next);
          offset.setValue(-out);
          slide(0);
        });
      },
      onPanResponderTerminate: () => slide(0),
    }),
  );

  return { offset, panHandlers: responder.panHandlers };
}

export default function SocialScreen() {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('groups');
  const [refreshing, setRefreshing] = useState(false);
  const inbox = useInboxCount();
  const swipe = useTabSwipe(tab, setTab);

  async function refresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: socialKeys.all });
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          tintColor={colors.primary}
          colors={[colors.primary]}
          refreshing={refreshing}
          onRefresh={refresh}
        />
      }
    >
      <Stack.Screen
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
      />
      <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      <Animated.View {...swipe.panHandlers} style={{ transform: [{ translateX: swipe.offset }] }}>
        {tab === 'groups' ? <GroupsPanel /> : <FriendsPanel />}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20 },
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

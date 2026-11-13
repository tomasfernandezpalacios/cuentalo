import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useNavigation } from 'expo-router';
import { useTabAnimation } from 'expo-router/js-top-tabs';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { FriendsPanel } from '@/features/social/components/FriendsPanel';
import { GroupsPanel } from '@/features/social/components/GroupsPanel';
import { socialKeys, useInboxCount } from '@/features/social/hooks';
import { useThemeColors } from '@/lib/theme';

export type SocialTab = 'friends' | 'groups';

const TABS: { value: SocialTab; label: string }[] = [
  { value: 'groups', label: 'Grupos' },
  { value: 'friends', label: 'Amigos' },
];

/** Nombre de la ruta de cada página en el deslizador principal (`app/(tabs)/_layout.tsx`). */
export const SOCIAL_ROUTES: Record<SocialTab, string> = { groups: 'social', friends: 'amigos' };

/** Posición de las dos páginas de Social en el deslizador principal (Grupos, Amigos). */
const SOCIAL_INDEX = 2;

/**
 * Una página de «Social»: Grupos o Amigos. Son dos páginas del deslizador principal, así que de
 * Grupos se pasa a Estadísticas y de Amigos a Mi perfil deslizando, y entre las dos igual. El
 * selector sigue al dedo con la posición del deslizador.
 */
export function SocialPage({ page }: { page: SocialTab }) {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const inbox = useInboxCount();
  const { position: tabPosition } = useTabAnimation();
  const position = tabPosition.interpolate({
    inputRange: [SOCIAL_INDEX, SOCIAL_INDEX + 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  async function refresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: socialKeys.all });
    setRefreshing(false);
  }

  function selectTab(next: SocialTab) {
    if (next !== page) navigation.navigate(SOCIAL_ROUTES[next] as never);
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          // collapsable={false}: con varios botones en la cabecera de Android, sin él los toques
          // pueden no llegar.
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
      <View style={styles.selector}>
        <SegmentedControl options={TABS} value={page} onChange={selectTab} position={position} />
      </View>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.page}
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
        {page === 'groups' ? <GroupsPanel /> : <FriendsPanel />}
      </ScrollView>
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

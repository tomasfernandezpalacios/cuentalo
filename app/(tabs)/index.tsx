import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { CounterCard } from '@/features/contadores/components/CounterCard';
import { useCounterList } from '@/features/contadores/hooks';
import { useThemeColors } from '@/lib/theme';

function openNewCounter() {
  router.push('/contadores/nuevo');
}

export default function CountersScreen() {
  const colors = useThemeColors();
  const { data, error, isPending, isRefetching, refetch } = useCounterList();
  const [showArchived, setShowArchived] = useState(false);

  if (isPending) return <LoadingView />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const archivedCount = data.filter((c) => c.archived).length;
  const counters = showArchived ? data : data.filter((c) => !c.archived);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={openNewCounter}
              accessibilityRole="button"
              accessibilityLabel="Nuevo contador"
              hitSlop={12}
              style={styles.headerButton}
            >
              <Ionicons name="add" size={28} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={counters}
        keyExtractor={(counter) => counter.id}
        renderItem={({ item }) => (
          <CounterCard
            counter={item}
            onPress={() => router.push({ pathname: '/contadores/[id]', params: { id: item.id } })}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
        ListEmptyComponent={
          <EmptyView
            title="Aún no tienes contadores"
            description="Crea uno para empezar a contar: cervezas, libros, kilómetros…"
            actionTitle="Crear contador"
            onAction={openNewCounter}
          />
        }
        ListFooterComponent={
          archivedCount > 0 ? (
            <AppButton
              variant="ghost"
              title={showArchived ? 'Ocultar archivados' : `Ver archivados (${archivedCount})`}
              onPress={() => setShowArchived((value) => !value)}
            />
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  headerButton: { marginRight: 16 },
});

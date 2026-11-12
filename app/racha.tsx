import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { usePullRefresh } from '@/lib/usePullRefresh';
import { Section } from '@/components/Section';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { useStreak } from '@/features/estadisticas/api';
import { FriendsStreaks } from '@/features/estadisticas/components/FriendsStreaks';
import { StreakCalendar } from '@/features/estadisticas/components/StreakCalendar';
import { StreakCard } from '@/features/estadisticas/components/StreakCard';
import { useThemeColors } from '@/lib/theme';

/** Tu racha: el rectángulo grande con el fuego y el calendario de días con actividad. */
export default function StreakScreen() {
  const colors = useThemeColors();
  const streak = useStreak();
  const pull = usePullRefresh(() => streak.refetch());

  if (streak.isPending) return <LoadingView />;
  if (streak.isError) return <ErrorView error={streak.error} onRetry={streak.refetch} />;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          tintColor={colors.primary}
          colors={[colors.primary]}
          refreshing={pull.refreshing}
          onRefresh={pull.onRefresh}
        />
      }
    >
      <StreakCard />
      <StreakCalendar activeDays={streak.data.days} />

      <Section title="Rachas de amigos">
        <FriendsStreaks />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20 },
});

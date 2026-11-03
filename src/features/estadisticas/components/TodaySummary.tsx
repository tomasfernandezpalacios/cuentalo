import { StyleSheet, Text, View } from 'react-native';

import { useUserId } from '@/features/auth/AuthProvider';
import { formatAmount } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

import { useMyDailyTotals } from '../api';
import { isInPeriod, todayInMadrid } from '../periods';

/** Cabecera de la lista de contadores: cuántos registros llevo hoy y esta semana. */
export function TodaySummary() {
  const colors = useThemeColors();
  const { data } = useMyDailyTotals(useUserId());
  if (!data) return null;

  const today = todayInMadrid();
  const todayCount = data.filter((d) => d.day === today).reduce((n, d) => n + d.entryCount, 0);
  const weekCount = data
    .filter((d) => isInPeriod(d.day, today, 'week'))
    .reduce((n, d) => n + d.entryCount, 0);

  return (
    <View
      accessible
      accessibilityLabel={`Hoy llevas ${todayCount} registros, ${weekCount} esta semana`}
      style={[styles.card, { backgroundColor: colors.primary }]}
    >
      <View style={styles.block}>
        <Text style={[styles.value, { color: colors.onPrimary }]}>{formatAmount(todayCount)}</Text>
        <Text style={[styles.label, { color: colors.onPrimary }]}>registros hoy</Text>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.onPrimary }]} />
      <View style={styles.block}>
        <Text style={[styles.value, { color: colors.onPrimary }]}>{formatAmount(weekCount)}</Text>
        <Text style={[styles.label, { color: colors.onPrimary }]}>esta semana</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  block: { flex: 1, alignItems: 'center', gap: 2 },
  value: { fontSize: 32, fontFamily: fonts.title },
  label: { fontSize: 14, fontFamily: fonts.detail, opacity: 0.85 },
  divider: { width: 1, alignSelf: 'stretch', opacity: 0.3 },
});

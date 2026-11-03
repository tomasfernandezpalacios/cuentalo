import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { useUserId } from '@/features/auth/AuthProvider';
import { getErrorMessage } from '@/lib/errors';
import { formatWithUnit } from '@/lib/format';
import { fonts, useThemeColors } from '@/lib/theme';

import type { LeaderboardPeriod } from '../api';
import { useLeaderboard } from '../hooks';

import { CounterAvatar } from './CounterAvatar';

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
  { value: 'all', label: 'Histórico' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

type Props = { counterId: string; unit: string | null };

/** Clasificación de un contador compartido. Se refresca sola al registrar (misma caché). */
export function Leaderboard({ counterId, unit }: Props) {
  const colors = useThemeColors();
  const userId = useUserId();
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const leaderboard = useLeaderboard(counterId, period, true);

  return (
    <View style={styles.container}>
      <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} />
      {leaderboard.isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : leaderboard.isError ? (
        <Text style={[styles.muted, { color: colors.danger }]}>
          {getErrorMessage(leaderboard.error)}
        </Text>
      ) : (
        <View>
          {leaderboard.data.map((row) => {
            const isMe = row.userId === userId;
            const medal = row.total > 0 ? MEDALS[row.position - 1] : undefined;
            return (
              <View
                key={row.userId}
                accessible
                accessibilityLabel={`Posición ${row.position}: ${isMe ? 'tú' : row.displayName}, ${formatWithUnit(row.total, unit)}`}
                style={[
                  styles.row,
                  { borderBottomColor: colors.border },
                  isMe && { backgroundColor: colors.primarySoft },
                ]}
              >
                <Text style={[styles.position, { color: colors.textMuted }]}>
                  {medal ?? row.position}
                </Text>
                <CounterAvatar emoji={null} name={row.displayName} size={34} />
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {isMe ? `${row.displayName} (tú)` : row.displayName}
                  </Text>
                  <Text style={[styles.muted, { color: colors.textMuted }]}>@{row.username}</Text>
                </View>
                <Text style={[styles.total, { color: colors.text }]} numberOfLines={1}>
                  {formatWithUnit(row.total, unit)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  position: { width: 28, textAlign: 'center', fontSize: 18, fontFamily: fonts.title },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontFamily: fonts.title },
  muted: { fontSize: 13, fontFamily: fonts.detail },
  total: { fontSize: 16, fontFamily: fonts.title, maxWidth: '40%' },
});

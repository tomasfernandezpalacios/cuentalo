import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { useUserId } from '@/features/auth/AuthProvider';
import { getErrorMessage } from '@/lib/errors';
import { formatWithUnit, pluralize } from '@/lib/format';
import { UserAvatar } from '@/features/perfil/PersonAvatar';
import { openProfile } from '@/features/social/openProfile';
import { fonts, useThemeColors } from '@/lib/theme';

import type { LeaderboardPeriod } from '../api';
import { useLeaderboard, useStreakLeaderboard } from '../hooks';

export const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
  { value: 'all', label: 'Histórico' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

type Props = {
  counterId: string;
  unit: string | null;
  /** Formato racha: además del total, se ve la racha de días de cada uno. */
  streak?: boolean;
  /** Periodo controlado desde fuera (la gráfica del grupo usa el mismo). */
  period?: LeaderboardPeriod;
  onChangePeriod?: (period: LeaderboardPeriod) => void;
};

/** Clasificación de un contador compartido. Se refresca sola al registrar (misma caché). */
export function Leaderboard({
  counterId,
  unit,
  streak = false,
  period: controlledPeriod,
  onChangePeriod,
}: Props) {
  const colors = useThemeColors();
  const userId = useUserId();
  const [ownPeriod, setOwnPeriod] = useState<LeaderboardPeriod>('week');
  const period = controlledPeriod ?? ownPeriod;
  const setPeriod = onChangePeriod ?? setOwnPeriod;
  const leaderboard = useLeaderboard(counterId, period, true);
  const streaks = useStreakLeaderboard(counterId, streak);
  const streakDays = new Map((streaks.data ?? []).map((row) => [row.userId, row.total]));

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
              // Tocar a otra persona abre su perfil.
              <Pressable
                key={row.userId}
                onPress={() => openProfile(row.userId)}
                disabled={isMe}
                accessibilityRole={isMe ? undefined : 'button'}
                accessibilityLabel={`Posición ${row.position}: ${isMe ? 'tú' : row.displayName}, ${formatWithUnit(row.total, unit)}`}
                accessibilityHint={isMe ? undefined : 'Abre su perfil'}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  isMe && { backgroundColor: colors.primarySoft },
                ]}
              >
                <Text style={[styles.position, { color: colors.textMuted }]}>
                  {medal ?? row.position}
                </Text>
                <UserAvatar userId={row.userId} name={row.displayName} size={34} />
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {isMe ? `${row.displayName} (tú)` : row.displayName}
                  </Text>
                  <Text style={[styles.muted, { color: colors.textMuted }]} numberOfLines={1}>
                    @{row.username}
                    {streak && streakDays.has(row.userId)
                      ? ` · 🔥 ${pluralize(streakDays.get(row.userId) ?? 0, 'día', 'días')}`
                      : ''}
                  </Text>
                </View>
                <Text style={[styles.total, { color: colors.text }]} numberOfLines={1}>
                  {formatWithUnit(row.total, unit)}
                </Text>
              </Pressable>
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

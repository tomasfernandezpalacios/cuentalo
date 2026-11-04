import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useUserId } from '@/features/auth/AuthProvider';
import { getErrorMessage } from '@/lib/errors';
import { UserAvatar } from '@/features/perfil/PersonAvatar';
import { fonts, useThemeColors } from '@/lib/theme';

import { useFriendsStreaks } from '../api';
import { withPositions } from '../streaks';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Clasificación de rachas: tú y tus amigos, de mayor a menor racha actual. */
export function FriendsStreaks() {
  const colors = useThemeColors();
  const userId = useUserId();
  const streaks = useFriendsStreaks();

  if (streaks.isPending) return <ActivityIndicator color={colors.primary} />;
  if (streaks.isError) {
    return (
      <Text style={[styles.detail, { color: colors.danger }]}>
        {getErrorMessage(streaks.error)}
      </Text>
    );
  }

  const rows = streaks.data;
  if (rows.length <= 1) {
    return (
      <Text style={[styles.detail, { color: colors.textMuted }]}>
        Añade amigos en «Amigos y grupos» para comparar vuestras rachas.
      </Text>
    );
  }

  // Posición con empates: quien tiene la misma racha actual comparte puesto.
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {withPositions(rows, (r) => r.current).map((row, index) => {
        const { position } = row;
        const isMe = row.userId === userId;
        const medal = row.current > 0 ? MEDALS[position - 1] : undefined;
        // En color solo si hoy ya ha mantenido la racha.
        const flameColor = row.activeToday ? colors.flame : colors.textMuted;
        return (
          <View
            key={row.userId}
            accessible
            accessibilityLabel={`Posición ${position}: ${isMe ? 'tú' : row.displayName}, ${row.current} ${row.current === 1 ? 'día' : 'días'} de racha`}
            style={[
              styles.row,
              index > 0 && {
                borderTopColor: colors.border,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
              isMe && { backgroundColor: colors.primarySoft },
            ]}
          >
            <Text style={[styles.position, { color: colors.textMuted }]}>{medal ?? position}</Text>
            <UserAvatar userId={row.userId} name={row.displayName} size={34} />
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {isMe ? `${row.displayName} (tú)` : row.displayName}
              </Text>
              <Text style={[styles.detail, { color: colors.textMuted }]} numberOfLines={1}>
                Mejor racha: {row.best}
              </Text>
            </View>
            <View style={styles.streak}>
              <Ionicons name="flame" size={20} color={flameColor} />
              <Text style={[styles.number, { color: flameColor }]}>{row.current}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  position: { width: 28, textAlign: 'center', fontSize: 18, fontFamily: fonts.title },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontFamily: fonts.title },
  detail: { fontSize: 13, fontFamily: fonts.detail },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  number: { fontSize: 18, fontFamily: fonts.title },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { useUserId } from '@/features/auth/AuthProvider';
import { useGroup } from '@/features/social/hooks';
import { fonts, useThemeColors } from '@/lib/theme';

type Props = {
  groupId: string;
  selected: string[];
  onChange: (userIds: string[]) => void;
};

/** Lista de miembros activos del grupo con casillas y un botón "Todos". */
export function ParticipantsPicker({ groupId, selected, onChange }: Props) {
  const colors = useThemeColors();
  const userId = useUserId();
  const group = useGroup(groupId);

  if (group.isPending) return <ActivityIndicator color={colors.primary} />;
  if (group.isError) return null;

  const members = group.data.members.filter((m) => m.status === 'active');
  const allSelected = members.every((m) => selected.includes(m.user_id));

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.text }]}>
          ¿A quién se le suma? ({selected.length})
        </Text>
        <AppButton
          small
          variant={allSelected ? 'secondary' : 'primary'}
          title={allSelected ? 'Ninguno' : 'Todos'}
          onPress={() => onChange(allSelected ? [] : members.map((m) => m.user_id))}
        />
      </View>
      {members.map((m) => {
        const checked = selected.includes(m.user_id);
        return (
          <Pressable
            key={m.user_id}
            onPress={() => toggle(m.user_id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={m.profile.display_name}
            style={styles.row}
          >
            <Ionicons
              name={checked ? 'checkbox' : 'square-outline'}
              size={24}
              color={checked ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {m.profile.display_name}
              {m.user_id === userId ? ' (tú)' : ''}
            </Text>
            <Text style={[styles.username, { color: colors.textMuted }]} numberOfLines={1}>
              @{m.profile.username}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: { fontSize: 15, fontFamily: fonts.detail, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  name: { fontSize: 15, fontFamily: fonts.title, flexShrink: 1 },
  username: { fontSize: 13, fontFamily: fonts.detail, flexShrink: 1 },
});

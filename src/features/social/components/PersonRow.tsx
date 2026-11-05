import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PersonAvatar } from '@/features/perfil/PersonAvatar';
import { fonts, useThemeColors } from '@/lib/theme';

import type { PublicProfile } from '../api';
import { openProfile } from '../openProfile';

type Props = {
  profile: PublicProfile;
  /** Texto pequeño bajo el @usuario (p. ej. "Invitado", "Owner"). */
  note?: string;
  /** Botones a la derecha. */
  actions?: ReactNode;
};

/** Fila de una persona. Tocar su foto o su nombre abre su perfil. */
export function PersonRow({ profile, note, actions }: Props) {
  const colors = useThemeColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Pressable
        onPress={() => openProfile(profile.id)}
        accessibilityRole="button"
        accessibilityLabel={`${profile.display_name}, @${profile.username}${note ? `, ${note}` : ''}`}
        accessibilityHint="Abre su perfil"
        style={({ pressed }) => [styles.person, { opacity: pressed ? 0.6 : 1 }]}
      >
        <PersonAvatar
          name={profile.display_name}
          emoji={profile.emoji}
          photoPath={profile.photo_path}
          size={40}
        />
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {profile.display_name}
          </Text>
          <Text style={[styles.detail, { color: colors.textMuted }]} numberOfLines={1}>
            @{profile.username}
            {note ? ` · ${note}` : ''}
          </Text>
        </View>
      </Pressable>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontFamily: fonts.title },
  detail: { fontSize: 13, fontFamily: fonts.detail },
  actions: { flexDirection: 'row', gap: 6 },
});

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/features/perfil/PersonAvatar';
import { openProfile } from '@/features/social/openProfile';
import { displayFont, fonts, shape, useThemeColors } from '@/lib/theme';

export type PodiumEntry = {
  userId: string;
  name: string;
  position: number;
  /** Lo que se enseña bajo el nombre (total, días de racha…). */
  value: ReactNode;
  /** Texto del valor para el lector de pantalla. */
  valueLabel: string;
  isMe: boolean;
};

// Orden de las columnas en pantalla: 2.º a la izquierda, 1.º en el centro y 3.º a la derecha.
const COLUMN_ORDER = [1, 0, 2];
// Altura de cada escalón y tamaño de cada foto (1.º, 2.º, 3.º).
const STEP_HEIGHT = [96, 72, 56];
const AVATAR = [64, 52, 52];

/**
 * Podio con los tres primeros de una clasificación (petición del usuario): la foto de cada uno
 * sobre su escalón, el 1.º en el centro, más alto y con corona. Tocar a otra persona abre su
 * perfil. Con menos de tres, se dibujan solo los que hay.
 */
export function Podium({ entries }: { entries: PodiumEntry[] }) {
  const colors = useThemeColors();
  if (entries.length === 0) return null;

  return (
    <View style={styles.podium} accessibilityRole="summary">
      {COLUMN_ORDER.map((place) => {
        const entry = entries[place];
        if (!entry) return <View key={place} style={styles.column} />;
        const first = place === 0;
        return (
          <Pressable
            key={entry.userId}
            onPress={() => openProfile(entry.userId)}
            disabled={entry.isMe}
            accessibilityRole={entry.isMe ? undefined : 'button'}
            accessibilityLabel={`Puesto ${entry.position}: ${entry.isMe ? 'tú' : entry.name}, ${entry.valueLabel}`}
            accessibilityHint={entry.isMe ? undefined : 'Abre su perfil'}
            style={({ pressed }) => [styles.column, { opacity: pressed ? 0.7 : 1 }]}
          >
            {first ? <Text style={styles.crown}>👑</Text> : null}
            <View>
              <View
                style={[styles.avatarRing, { borderColor: first ? colors.primary : colors.border }]}
              >
                <UserAvatar userId={entry.userId} name={entry.name} size={AVATAR[place] ?? 52} />
              </View>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: first ? colors.primary : colors.elevated },
                ]}
              >
                <Text style={[styles.badgeText, { color: first ? colors.onPrimary : colors.text }]}>
                  {entry.position}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.step,
                {
                  height: STEP_HEIGHT[place] ?? 56,
                  backgroundColor: first ? colors.primarySoft : colors.surface,
                  borderColor: first ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {entry.isMe ? 'Tú' : entry.name}
              </Text>
              <View style={styles.value}>{entry.value}</View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** El número grande del escalón, con la letra de las cifras. */
export function PodiumNumber({ children, color }: { children: ReactNode; color: string }) {
  return (
    <Text style={[styles.number, { color }]} numberOfLines={1} adjustsFontSizeToFit>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 8 },
  column: { flex: 1, alignItems: 'center', gap: 6 },
  crown: { fontSize: 24, marginBottom: -4 },
  avatarRing: { borderWidth: 2, borderRadius: 999, padding: 2 },
  badge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 12, fontFamily: fonts.title },
  step: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: shape.card / 1.5,
    borderTopRightRadius: shape.card / 1.5,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingTop: 10,
    gap: 2,
    marginTop: 4,
  },
  name: { fontSize: 14, fontFamily: fonts.title, maxWidth: '100%' },
  value: { flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: '100%' },
  number: { ...displayFont(20) },
});

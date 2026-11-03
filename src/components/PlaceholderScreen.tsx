import { StyleSheet, Text, View } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

type Props = {
  title: string;
  description: string;
};

/** Pantalla provisional mientras se implementa cada pestaña. */
export function PlaceholderScreen({ title, description }: Props) {
  const colors = useThemeColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 22, fontFamily: fonts.title },
  description: { fontSize: 15, textAlign: 'center', fontFamily: fonts.detail },
});

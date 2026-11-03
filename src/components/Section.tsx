import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

type Props = { title: string; children: ReactNode };

/** Bloque con título de sección. */
export function Section({ title, children }: Props) {
  const colors = useThemeColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  title: { fontSize: 18, fontFamily: fonts.title },
});

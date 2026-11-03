import { StyleSheet, Text, View } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

type Props = {
  emoji: string | null;
  name: string;
  size?: number;
};

/** Emoticono del contador sobre un fondo suave; si no tiene, la inicial del nombre. */
export function CounterAvatar({ emoji, name, size = 44 }: Props) {
  const colors = useThemeColors();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: size * 0.3,
          backgroundColor: colors.primarySoft,
        },
      ]}
    >
      {emoji ? (
        <Text style={{ fontSize: size * 0.55 }} allowFontScaling={false}>
          {emoji}
        </Text>
      ) : (
        <Text
          allowFontScaling={false}
          style={{ fontSize: size * 0.45, fontFamily: fonts.title, color: colors.primary }}
        >
          {name.trim().charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
});

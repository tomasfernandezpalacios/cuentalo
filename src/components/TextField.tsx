import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
};

export function TextField({ label, error, style, ...inputProps }: Props) {
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
          },
          style,
        ]}
        {...inputProps}
      />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 15, fontFamily: fonts.detail },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  error: { fontSize: 13, fontFamily: fonts.detail },
});

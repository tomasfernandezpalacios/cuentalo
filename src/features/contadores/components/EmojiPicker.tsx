import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { fonts, useThemeColors } from '@/lib/theme';

// Sugerencias para las actividades más típicas; con el campo de abajo se puede usar cualquiera.
const SUGGESTIONS = '🍺 🍷 ☕ 💧 📚 🎬 🎮 🎵 🏃 🚶 🚴 🏊 🏋️ 🧘 ⚽ 🎾 ✈️ 🚗 🍕 🍔 🚬 📝 💪 🎉'.split(
  ' ',
);

type Props = {
  value: string;
  onChange: (emoji: string) => void;
};

export function EmojiPicker({ value, onChange }: Props) {
  const colors = useThemeColors();
  const isCustom = value !== '' && !SUGGESTIONS.includes(value);
  const typed = isCustom ? value : '';

  // Si se escribe un emoticono nuevo detrás del que ya había, nos quedamos solo con el nuevo:
  // así se puede cambiar sin tener que borrar antes. Al borrar, se respeta lo que queda.
  function handleTyping(text: string) {
    const added = text.startsWith(typed) ? text.slice(typed.length) : text;
    onChange((added.trim() || text).trim());
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>Emoticono (opcional)</Text>
      <View style={styles.grid}>
        {SUGGESTIONS.map((emoji) => {
          const selected = emoji === value;
          return (
            <Pressable
              key={emoji}
              // Pulsar el elegido otra vez lo quita.
              onPress={() => onChange(selected ? '' : emoji)}
              accessibilityRole="button"
              accessibilityLabel={`Emoticono ${emoji}`}
              accessibilityState={{ selected }}
              style={[
                styles.cell,
                {
                  backgroundColor: selected ? colors.primarySoft : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={typed}
        onChangeText={handleTyping}
        placeholder="…o escribe otro con el teclado"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Otro emoticono"
        maxLength={20}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: isCustom ? colors.primary : colors.border,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontSize: 15, fontFamily: fonts.detail },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 20 },
});
